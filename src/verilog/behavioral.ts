// ---------------------------------------------------------------------------
// Behavioral Verilog: the classic three-block FSM (state register, next-state
// logic, output logic) using `case` statements. Aggressively commented so each
// branch is traceable to an arc or state in the diagram.
// ---------------------------------------------------------------------------

import type { Assignment, FSM } from '../model/types';
import { buildEncoding } from './encoding';
import { banner, describeTransition } from './comments';

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

export function generateBehavioral(fsm: FSM): string {
  if (fsm.states.length === 0) {
    return '// Add at least one state to generate Verilog.';
  }

  const enc = buildEncoding(fsm);
  const nb = enc.numBits;
  const reset = enc.codes[0]; // reset state is index 0
  const out: string[] = [];

  out.push(banner('Behavioral FSM  —  auto-generated from the state diagram'));
  out.push(`// Type: ${fsm.config.type.toUpperCase()}   Encoding: ${fsm.config.encoding}`);
  out.push('');
  out.push('module fsm (');
  out.push(portList(fsm));
  out.push(');');
  out.push('');

  // ---- State encodings -------------------------------------------------
  out.push('  // State encodings');
  for (const c of enc.codes) {
    out.push(`  localparam [${nb - 1}:0] ${c.state.label} = ${nb}'b${c.bits};`);
  }
  out.push('');
  out.push(`  reg [${nb - 1}:0] state, next_state;`);
  out.push('');

  // ---- State register --------------------------------------------------
  out.push('  // State register: synchronous reset to the designated reset state');
  out.push('  always @(posedge clk) begin');
  out.push('    if (rst)');
  out.push(`      state <= ${reset.state.label};`);
  out.push('    else');
  out.push('      state <= next_state;');
  out.push('  end');
  out.push('');

  // ---- Next-state logic ------------------------------------------------
  out.push('  // Next-state logic');
  out.push('  always @(*) begin');
  out.push('    next_state = state; // default: hold current state');
  out.push('    case (state)');
  for (const c of enc.codes) {
    const outs = fsm.transitions.filter((t) => t.source === c.state.id);
    out.push(`      ${c.state.label}: begin`);
    if (outs.length === 0) {
      out.push('        // no outgoing transitions');
    }
    for (const t of outs) {
      const tgt = enc.byId.get(t.target)?.state.label ?? '?';
      out.push(`        if (${guardCond(t.guard, fsm.config.inputs)}) next_state = ${tgt}; // ${describeTransition(fsm, t)}`);
    }
    out.push('      end');
  }
  out.push('      default: next_state = ' + reset.state.label + ';');
  out.push('    endcase');
  out.push('  end');
  out.push('');

  // ---- Output logic ----------------------------------------------------
  out.push('  // Output logic');
  out.push('  always @(*) begin');
  for (const o of fsm.config.outputs) out.push(`    ${o} = 1'b0; // default`);
  if (fsm.config.type === 'moore') {
    out.push('    case (state) // Moore: outputs depend only on the current state');
    for (const c of enc.codes) {
      out.push(`      ${c.state.label}: begin`);
      for (const o of fsm.config.outputs) {
        out.push(`        ${o} = 1'b${c.state.outputs[o] ?? 0};`);
      }
      out.push('      end');
    }
    out.push('      default: ;');
    out.push('    endcase');
  } else {
    out.push('    case (state) // Mealy: outputs depend on state AND inputs (the arc taken)');
    for (const c of enc.codes) {
      const outs = fsm.transitions.filter((t) => t.source === c.state.id);
      out.push(`      ${c.state.label}: begin`);
      for (const t of outs) {
        const sets = fsm.config.outputs
          .filter((o) => (t.outputs[o] ?? 0) === 1)
          .map((o) => `${o} = 1'b1;`);
        if (sets.length > 0) {
          out.push(`        if (${guardCond(t.guard, fsm.config.inputs)}) begin ${sets.join(' ')} end // ${describeTransition(fsm, t)}`);
        }
      }
      out.push('      end');
    }
    out.push('      default: ;');
    out.push('    endcase');
  }
  out.push('  end');
  out.push('');
  out.push('endmodule');

  return out.join('\n');
}
