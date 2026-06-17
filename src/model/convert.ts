// ---------------------------------------------------------------------------
// Mealy <-> Moore conversion.
//
// Moore -> Mealy is ALWAYS lossless: a Moore state that outputs a vector V
// simply asserts V on every one of its outgoing arcs.
//
// Mealy -> Moore is lossy when a state's OUTGOING arcs assert DIFFERENT output
// vectors -- i.e. the output genuinely depends on the input, which a Moore
// state (output depends only on the state) cannot express. This is the exact
// inverse of the Moore->Mealy rule (a Moore output maps onto all OUTGOING
// arcs), so a Moore->Mealy->Moore round-trip is lossless. We detect the lossy
// states, warn, and on confirm zero-out the offending state's output.
// ---------------------------------------------------------------------------

import type { Assignment, FSM } from './types';

/** Stable string key for an output assignment, for equality comparison. */
function outputKey(outputs: Assignment, names: string[]): string {
  return names.map((n) => `${n}=${outputs[n] ?? 0}`).join(',');
}

/** Moore -> Mealy: push each state's outputs onto its outgoing transitions. */
export function mooreToMealy(fsm: FSM): FSM {
  const outByState = new Map<string, Assignment>();
  for (const s of fsm.states) outByState.set(s.id, s.outputs);

  return {
    ...fsm,
    config: { ...fsm.config, type: 'mealy' },
    // Moore outputs now live on the edges; clear them on the states.
    states: fsm.states.map((s) => ({ ...s, outputs: {} })),
    transitions: fsm.transitions.map((t) => ({
      ...t,
      outputs: { ...(outByState.get(t.source) ?? {}) },
    })),
  };
}

export interface MealyToMooreResult {
  fsm: FSM;
  /** Labels of states whose incoming arcs disagreed (output was zeroed out). */
  lossyStateLabels: string[];
}

/**
 * Mealy -> Moore. Groups transitions by source state; if all of a state's
 * outgoing arcs agree on an output vector that vector becomes the state's Moore
 * output, otherwise the state is flagged as lossy and its output zeroed.
 */
export function mealyToMoore(fsm: FSM): MealyToMooreResult {
  const names = fsm.config.outputs;
  const outgoing = new Map<string, Assignment[]>();
  for (const t of fsm.transitions) {
    const list = outgoing.get(t.source) ?? [];
    list.push(t.outputs);
    outgoing.set(t.source, list);
  }

  const lossyStateLabels: string[] = [];
  const states = fsm.states.map((s) => {
    const arcs = outgoing.get(s.id) ?? [];
    if (arcs.length === 0) return { ...s, outputs: {} };

    const firstKey = outputKey(arcs[0], names);
    const allAgree = arcs.every((a) => outputKey(a, names) === firstKey);
    if (allAgree) {
      return { ...s, outputs: { ...arcs[0] } };
    }
    lossyStateLabels.push(s.label);
    return { ...s, outputs: {} }; // zero-out on conflict
  });

  return {
    fsm: {
      ...fsm,
      config: { ...fsm.config, type: 'moore' },
      states,
      transitions: fsm.transitions.map((t) => ({ ...t, outputs: {} })),
    },
    lossyStateLabels,
  };
}
