// ---------------------------------------------------------------------------
// The "Four Rules" of a well-formed FSM, each a pure function of the model.
// The checklist panel renders these red/green with the `detail` on hover.
//
//   1. Completely specified  -- every state covers all input combinations
//   2. Uniquely specified    -- no state has overlapping outgoing conditions
//   3. Has a reset state      -- a designated initial state exists
//   4. Pure Mealy/Moore       -- outputs live only where the mode allows
// ---------------------------------------------------------------------------

import type { FSM } from '../model/types';
import { fullMintermSet, guardToMinterms, mintermToBits } from '../model/minterms';

export interface RuleResult {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

function hasAnyOutput(a: Record<string, unknown>): boolean {
  return Object.keys(a).length > 0;
}

/** Rule 1: every state's outgoing guards together cover all 2^|inputs| inputs. */
function completelySpecified(fsm: FSM): RuleResult {
  const id = 'complete';
  const label = 'Completely specified';
  if (fsm.states.length === 0) {
    return { id, label, pass: false, detail: 'Add at least one state.' };
  }
  const n = fsm.config.inputs.length;
  const universe = fullMintermSet(n);
  const problems: string[] = [];

  for (const state of fsm.states) {
    const covered = new Set<number>();
    for (const t of fsm.transitions) {
      if (t.source !== state.id) continue;
      for (const m of guardToMinterms(t.guard, fsm.config.inputs)) covered.add(m);
    }
    const missing = [...universe].filter((m) => !covered.has(m));
    if (missing.length > 0) {
      const sample = missing
        .slice(0, 4)
        .map((m) => mintermToBits(m, fsm.config.inputs))
        .join(', ');
      const more = missing.length > 4 ? `, +${missing.length - 4} more` : '';
      problems.push(`${state.label}: missing inputs ${sample}${more}`);
    }
  }

  return problems.length === 0
    ? { id, label, pass: true, detail: 'Every state handles all input combinations.' }
    : { id, label, pass: false, detail: problems.join('; ') };
}

/** Rule 2: no state has two outgoing arcs whose conditions overlap. */
function uniquelySpecified(fsm: FSM): RuleResult {
  const id = 'unique';
  const label = 'Uniquely specified';
  const problems: string[] = [];

  for (const state of fsm.states) {
    const outs = fsm.transitions.filter((t) => t.source === state.id);
    const sets = outs.map((t) => guardToMinterms(t.guard, fsm.config.inputs));
    for (let i = 0; i < outs.length; i++) {
      for (let j = i + 1; j < outs.length; j++) {
        const overlap = [...sets[i]].some((m) => sets[j].has(m));
        if (overlap) {
          const aTgt = fsm.states.find((s) => s.id === outs[i].target)?.label ?? '?';
          const bTgt = fsm.states.find((s) => s.id === outs[j].target)?.label ?? '?';
          problems.push(`${state.label}: arcs to ${aTgt} and ${bTgt} overlap`);
        }
      }
    }
  }

  return problems.length === 0
    ? { id, label, pass: true, detail: 'No conflicting transitions.' }
    : { id, label, pass: false, detail: problems.join('; ') };
}

/** Rule 3: a designated reset state exists. */
function hasResetState(fsm: FSM): RuleResult {
  const id = 'reset';
  const label = 'Has a reset state';
  const exists =
    fsm.config.resetStateId != null &&
    fsm.states.some((s) => s.id === fsm.config.resetStateId);
  return {
    id,
    label,
    pass: exists,
    detail: exists
      ? `Reset = ${fsm.states.find((s) => s.id === fsm.config.resetStateId)?.label}.`
      : 'Right-click a state and mark it as the reset state.',
  };
}

/** Rule 4: outputs appear only where the chosen mode allows. */
function pureNotation(fsm: FSM): RuleResult {
  const id = 'pure';
  const label = `Uses only ${fsm.config.type === 'moore' ? 'Moore' : 'Mealy'} notation`;
  if (fsm.config.type === 'moore') {
    const bad = fsm.transitions.filter((t) => hasAnyOutput(t.outputs));
    return bad.length === 0
      ? { id, label, pass: true, detail: 'Outputs are all in the state bubbles.' }
      : { id, label, pass: false, detail: `${bad.length} arc(s) carry outputs — not allowed in Moore.` };
  }
  const bad = fsm.states.filter((s) => hasAnyOutput(s.outputs));
  return bad.length === 0
    ? { id, label, pass: true, detail: 'Outputs are all on the transitions.' }
    : { id, label, pass: false, detail: `${bad.map((s) => s.label).join(', ')} carry outputs — not allowed in Mealy.` };
}

export function validateFSM(fsm: FSM): RuleResult[] {
  return [
    completelySpecified(fsm),
    uniquelySpecified(fsm),
    hasResetState(fsm),
    pureNotation(fsm),
  ];
}
