// ---------------------------------------------------------------------------
// Behavioral Verilog: the classic three-block FSM (state register, next-state
// logic, output logic) using `case` statements. Aggressively commented so each
// branch is traceable to an arc or state in the diagram.
// ---------------------------------------------------------------------------

import type { Assignment, FSM } from '../model/types';
import { buildEncoding } from './encoding';
import { banner, describeTransition } from './comments';
import { makeEmitter, type GenResult } from './emit';

/** Verilog boolean condition for a guard, e.g. "A && !B"; empty => "1'b1". */
function guardCond(guard: Assignment, inputs: string[]): string {
  const lits = inputs.filter((n) => n in guard).map((n) => (guard[n] ? n : `!${n}`));
  return lits.length === 0 ? "1'b1" : lits.join(' && ');
}

function portList(fsm: FSM): string {
  const lines = ['input  wire clk', 'input  wire rst'];
  for (const i of fsm.config.inputs) lines.push(`input  wire ${i}`);
  for (const o of fsm.config.outputs) lines.push(`output reg  ${o}`);
  return lines.map((l) => '    ' + l).join(',\n');
}

export function generateBehavioral(fsm: FSM): GenResult {
  if (fsm.states.length === 0) {
    return { code: '// Add at least one state to generate Verilog.', owners: [null] };
  }

  const enc = buildEncoding(fsm);
  const nb = enc.numBits;
  const reset = enc.codes[0]; // reset state is index 0
  const e = makeEmitter();

  e.push(banner('Behavioral FSM  —  auto-generated from the state diagram'));
  e.push(`// Type: ${fsm.config.type.toUpperCase()}   Encoding: ${fsm.config.encoding}`);
  e.push('');
  e.push('module fsm (');
  e.push(portList(fsm));
  e.push(');');
  e.push('');

  // ---- State encodings -------------------------------------------------
  e.push('  // State encodings');
  for (const c of enc.codes) {
    e.push(`  localparam [${nb - 1}:0] ${c.state.label} = ${nb}'b${c.bits};`, c.state.id);
  }
  e.push('');
  e.push(`  reg [${nb - 1}:0] state, next_state;`);
  e.push('');

  // ---- State register --------------------------------------------------
  e.push('  // State register: synchronous reset to the designated reset state');
  e.push('  always @(posedge clk) begin');
  e.push('    if (rst)');
  e.push(`      state <= ${reset.state.label};`, reset.state.id);
  e.push('    else');
  e.push('      state <= next_state;');
  e.push('  end');
  e.push('');

  // ---- Next-state logic ------------------------------------------------
  e.push('  // Next-state logic');
  e.push('  always @(*) begin');
  e.push('    next_state = state; // default: hold current state');
  e.push('    case (state)');
  for (const c of enc.codes) {
    const outs = fsm.transitions.filter((t) => t.source === c.state.id);
    e.push(`      ${c.state.label}: begin`, c.state.id);
    if (outs.length === 0) {
      e.push('        // no outgoing transitions', c.state.id);
    }
    for (const t of outs) {
      const tgt = enc.byId.get(t.target)?.state.label ?? '?';
      e.push(`        if (${guardCond(t.guard, fsm.config.inputs)}) next_state = ${tgt}; // ${describeTransition(fsm, t)}`, t.id);
    }
    e.push('      end', c.state.id);
  }
  e.push('      default: next_state = ' + reset.state.label + ';');
  e.push('    endcase');
  e.push('  end');
  e.push('');

  // ---- Output logic ----------------------------------------------------
  e.push('  // Output logic');
  e.push('  always @(*) begin');
  for (const o of fsm.config.outputs) e.push(`    ${o} = 1'b0; // default`);
  if (fsm.config.type === 'moore') {
    e.push('    case (state) // Moore: outputs depend only on the current state');
    for (const c of enc.codes) {
      e.push(`      ${c.state.label}: begin`, c.state.id);
      for (const o of fsm.config.outputs) {
        e.push(`        ${o} = 1'b${c.state.outputs[o] ?? 0};`, c.state.id);
      }
      e.push('      end', c.state.id);
    }
    e.push('      default: ;');
    e.push('    endcase');
  } else {
    e.push('    case (state) // Mealy: outputs depend on state AND inputs (the arc taken)');
    for (const c of enc.codes) {
      const outs = fsm.transitions.filter((t) => t.source === c.state.id);
      e.push(`      ${c.state.label}: begin`, c.state.id);
      for (const t of outs) {
        const sets = fsm.config.outputs
          .filter((o) => (t.outputs[o] ?? 0) === 1)
          .map((o) => `${o} = 1'b1;`);
        if (sets.length > 0) {
          e.push(`        if (${guardCond(t.guard, fsm.config.inputs)}) begin ${sets.join(' ')} end // ${describeTransition(fsm, t)}`, t.id);
        }
      }
      e.push('      end', c.state.id);
    }
    e.push('      default: ;');
    e.push('    endcase');
  }
  e.push('  end');
  e.push('');
  e.push('endmodule');

  return e.result();
}
