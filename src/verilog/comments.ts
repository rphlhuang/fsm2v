// Helpers for the (aggressive) comments that tie generated Verilog back to the
// visual diagram. Kept ASCII-only so the comments are copy-paste safe.

import type { FSM, Transition } from '../model/types';
import { describeAssignment } from '../notation/serializeLabel';

export function stateLabelById(fsm: FSM, id: string): string {
  return fsm.states.find((s) => s.id === id)?.label ?? '?';
}

/** "S0 -> S1 when A=1, B=0" for a transition. */
export function describeTransition(fsm: FSM, t: Transition): string {
  const src = stateLabelById(fsm, t.source);
  const dst = stateLabelById(fsm, t.target);
  const cond = describeAssignment(t.guard, fsm.config.inputs, 'any input');
  return `${src} -> ${dst} when ${cond}`;
}

/** "X=1, Y=0" describing an output assignment (absent outputs shown as 0). */
export function describeOutputs(
  outputs: Record<string, 0 | 1>,
  names: string[],
): string {
  if (names.length === 0) return '(none)';
  return names.map((n) => `${n}=${outputs[n] ?? 0}`).join(', ');
}

const HR =
  '// ===========================================================================';

export function banner(title: string): string {
  return `${HR}\n// ${title}\n${HR}`;
}
