// ---------------------------------------------------------------------------
// Structural Verilog: state held in Xilinx FDRE/FDSE flip-flops, with the
// next-state D inputs and the FSM outputs driven by continuous `assign`
// statements whose boolean equations are minimized with Quine-McCluskey.
//
// FDRE resets (R) its Q to 0; FDSE sets (S) its Q to 1. Binary encoding puts
// the reset state at code 0, so every bit is an FDRE. One-hot needs the reset
// state's own bit to come up as 1, so that single flop is an FDSE.
// ---------------------------------------------------------------------------

import type { Assignment, FSM } from '../model/types';
import { inputWeight } from '../model/minterms';
import { QM_VAR_LIMIT, minimize, sopToVerilog } from '../logic/quineMcCluskey';
import { buildEncoding, type EncodingInfo } from './encoding';
import { banner, describeTransition } from './comments';
import { makeEmitter, type GenResult } from './emit';

/** Does input-minterm `m` satisfy `guard` (over ordered `inputs`)? */
function matchesGuard(m: number, guard: Assignment, inputs: string[]): boolean {
  for (let k = 0; k < inputs.length; k++) {
    if (!(inputs[k] in guard)) continue;
    const bit = m & inputWeight(k, inputs.length) ? 1 : 0;
    if (bit !== guard[inputs[k]]) return false;
  }
  return true;
}

interface TruthData {
  /** on-set per Q-bit position p (combined state+input index space). */
  onSet: Set<number>[];
  /** don't-care set shared by all next-state bits (unused codes / unmatched). */
  dontCare: Set<number>;
}

/** Build the next-state truth table over the (state-bits ++ inputs) space. */
function nextStateTruth(fsm: FSM, enc: EncodingInfo): TruthData {
  const nb = enc.numBits;
  const ni = fsm.config.inputs.length;
  const onSet = Array.from({ length: nb }, () => new Set<number>());
  const dontCare = new Set<number>();
  const byCode = new Map(enc.codes.map((c) => [c.code, c]));
  const inputSpace = 1 << ni;

  for (const c of enc.codes) {
    for (let m = 0; m < inputSpace; m++) {
      const x = c.code * inputSpace + m;
      const t = fsm.transitions.find(
        (tr) => tr.source === c.state.id && matchesGuard(m, tr.guard, fsm.config.inputs),
      );
      if (!t) {
        dontCare.add(x); // incompletely specified -> don't care
        continue;
      }
      const nextCode = enc.byId.get(t.target)?.code ?? 0;
      for (let p = 0; p < nb; p++) {
        if ((nextCode >> p) & 1) onSet[p].add(x);
      }
    }
  }

  // Unused state codes are don't-cares across the whole input space.
  for (let code = 0; code < 1 << nb; code++) {
    if (byCode.has(code)) continue;
    for (let m = 0; m < inputSpace; m++) dontCare.add(code * inputSpace + m);
  }

  return { onSet, dontCare };
}

function portList(fsm: FSM): string {
  const lines = ['input  wire clk', 'input  wire rst'];
  for (const i of fsm.config.inputs) lines.push(`input  wire ${i}`);
  for (const o of fsm.config.outputs) lines.push(`output wire ${o}`);
  return lines.map((l) => '    ' + l).join(',\n');
}

/** Q-register variable names (MSB-first) ++ input names: the QM variable order. */
function nextStateVars(fsm: FSM, enc: EncodingInfo): string[] {
  return [...enc.stateVarNames, ...fsm.config.inputs];
}

export function generateStructural(fsm: FSM): GenResult {
  if (fsm.states.length === 0) {
    return { code: '// Add at least one state to generate Verilog.', owners: [null] };
  }

  const enc = buildEncoding(fsm);
  const nb = enc.numBits;
  const ni = fsm.config.inputs.length;
  const oneHot = enc.encoding === 'one-hot';
  const reset = enc.codes[0];
  const e = makeEmitter();

  e.push(banner('Structural FSM  —  FDRE flip-flops + minimized SOP logic'));
  e.push(`// Type: ${fsm.config.type.toUpperCase()}   Encoding: ${fsm.config.encoding}`);
  if (nb + ni > QM_VAR_LIMIT) {
    e.push(`// NOTE: ${nb + ni} variables exceeds the QM limit (${QM_VAR_LIMIT}); equations are`);
    e.push('//       emitted in canonical (un-minimized) form to stay responsive.');
  }
  e.push('');
  e.push('module fsm (');
  e.push(portList(fsm));
  e.push(');');
  e.push('');

  // ---- State wires -----------------------------------------------------
  e.push('  // State register wires (Q) and next-state drives (D)');
  if (oneHot) {
    for (const c of enc.codes) {
      e.push(`  wire q_${c.state.label}, d_${c.state.label}; // 1 = machine is in ${c.state.label}`, c.state.id);
    }
  } else {
    e.push(`  wire [${nb - 1}:0] Q; // current state, encoded`);
    e.push(`  wire [${nb - 1}:0] D; // next state`);
  }
  e.push('');

  // ---- Flip-flops ------------------------------------------------------
  e.push('  // State flip-flops (Xilinx primitives)');
  if (oneHot) {
    for (const c of enc.codes) {
      const isReset = c.index === 0;
      if (isReset) {
        e.push(`  // ${c.state.label} is the reset state -> FDSE so it comes up as 1`, c.state.id);
        e.push(`  FDSE #(.INIT(1'b1)) ff_${c.state.label} (.C(clk), .CE(1'b1), .D(d_${c.state.label}), .S(rst), .Q(q_${c.state.label}));`, c.state.id);
      } else {
        e.push(`  FDRE #(.INIT(1'b0)) ff_${c.state.label} (.C(clk), .CE(1'b1), .D(d_${c.state.label}), .R(rst), .Q(q_${c.state.label}));`, c.state.id);
      }
    }
  } else {
    e.push(`  // Reset state ${reset.state.label} = ${nb}'b${reset.bits}, so all bits reset to 0`, reset.state.id);
    for (let p = nb - 1; p >= 0; p--) {
      e.push(`  FDRE #(.INIT(1'b0)) ff_Q${p} (.C(clk), .CE(1'b1), .D(D[${p}]), .R(rst), .Q(Q[${p}]));`);
    }
  }
  e.push('');

  // ---- Next-state equations -------------------------------------------
  const vars = nextStateVars(fsm, enc);
  const { onSet, dontCare } = nextStateTruth(fsm, enc);
  e.push('  // Next-state logic (minimized sum-of-products)');
  for (let p = 0; p < nb; p++) {
    const sop = minimize(nb + ni, onSet[p], dontCare);
    const expr = sopToVerilog(sop, vars);
    // Trace: which transitions drive this bit high (target code has bit p set).
    const drivers = fsm.transitions.filter((t) => {
      const code = enc.byId.get(t.target)?.code ?? 0;
      return (code >> p) & 1;
    });
    // One-hot bit p belongs to a specific state; binary bits are shared.
    const stateOwner = oneHot ? enc.codes.find((c) => c.index === p)!.state.id : null;
    const lhs = oneHot ? `d_${enc.codes.find((c) => c.index === p)!.state.label}` : `D[${p}]`;
    const meaning = oneHot
      ? `// ${lhs}: next state is ${enc.codes.find((c) => c.index === p)!.state.label}`
      : `// ${lhs}: bit ${p} of the next-state code`;
    e.push(`  ${meaning}`, stateOwner);
    for (const t of drivers) e.push(`  //   driven by: ${describeTransition(fsm, t)}`, t.id);
    e.push(`  assign ${lhs} = ${expr};`, stateOwner);
  }
  e.push('');

  // ---- Output equations ------------------------------------------------
  e.push('  // FSM outputs (minimized sum-of-products)');
  for (const o of fsm.config.outputs) {
    if (fsm.config.type === 'moore') {
      // Output is a function of the state bits only.
      const on = new Set<number>();
      const dc = new Set<number>();
      const byCode = new Map(enc.codes.map((c) => [c.code, c]));
      for (let code = 0; code < 1 << nb; code++) {
        const sc = byCode.get(code);
        if (!sc) dc.add(code);
        else if ((sc.state.outputs[o] ?? 0) === 1) on.add(code);
      }
      const sop = minimize(nb, on, dc);
      e.push(`  // ${o}: Moore output, high in states { ${enc.codes.filter((c) => (c.state.outputs[o] ?? 0) === 1).map((c) => c.state.label).join(', ') || 'none'} }`);
      e.push(`  assign ${o} = ${sopToVerilog(sop, enc.stateVarNames)};`);
    } else {
      // Mealy: function of state bits + inputs.
      const on = new Set<number>();
      const dc = new Set<number>();
      const inputSpace = 1 << ni;
      const byCode = new Map(enc.codes.map((c) => [c.code, c]));
      for (let code = 0; code < 1 << nb; code++) {
        const sc = byCode.get(code);
        for (let m = 0; m < inputSpace; m++) {
          const x = code * inputSpace + m;
          if (!sc) { dc.add(x); continue; }
          const t = fsm.transitions.find(
            (tr) => tr.source === sc.state.id && matchesGuard(m, tr.guard, fsm.config.inputs),
          );
          if (!t) dc.add(x);
          else if ((t.outputs[o] ?? 0) === 1) on.add(x);
        }
      }
      const sop = minimize(nb + ni, on, dc);
      e.push(`  // ${o}: Mealy output (depends on state and inputs)`);
      e.push(`  assign ${o} = ${sopToVerilog(sop, vars)};`);
    }
  }
  e.push('');
  e.push('endmodule');

  return e.result();
}
