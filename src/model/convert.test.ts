import { describe, expect, it } from 'vitest';
import { mooreToMealy, mealyToMoore } from './convert';
import type { FSM } from './types';

function base(): FSM {
  return {
    config: {
      type: 'moore',
      inputs: ['A'],
      outputs: ['Z'],
      resetStateId: 's0',
      encoding: 'binary',
      style: 'behavioral',
      notation: 'named',
    },
    states: [
      { id: 's0', label: 'S0', position: { x: 0, y: 0 }, outputs: { Z: 0 } },
      { id: 's1', label: 'S1', position: { x: 0, y: 0 }, outputs: { Z: 1 } },
    ],
    transitions: [
      { id: 't1', source: 's0', target: 's1', guard: { A: 1 }, outputs: {} },
      { id: 't2', source: 's1', target: 's1', guard: { A: 1 }, outputs: {} },
    ],
  };
}

describe('mooreToMealy', () => {
  it('pushes each state\'s output onto its outgoing arcs', () => {
    const mealy = mooreToMealy(base());
    expect(mealy.config.type).toBe('mealy');
    // S0 outputs Z=0 -> arc t1; S1 outputs Z=1 -> arc t2.
    expect(mealy.transitions.find((t) => t.id === 't1')!.outputs).toEqual({ Z: 0 });
    expect(mealy.transitions.find((t) => t.id === 't2')!.outputs).toEqual({ Z: 1 });
    expect(mealy.states.every((s) => Object.keys(s.outputs).length === 0)).toBe(true);
  });
});

describe('mealyToMoore', () => {
  it('is lossless when all arcs into a state agree', () => {
    const mealy = mooreToMealy(base());
    const { fsm, lossyStateLabels } = mealyToMoore(mealy);
    expect(lossyStateLabels).toEqual([]);
    expect(fsm.states.find((s) => s.id === 's1')!.outputs).toEqual({ Z: 1 });
  });

  it('flags and zeroes a state whose outgoing arcs disagree', () => {
    const mealy = mooreToMealy(base());
    // S1 already has an outgoing arc t2 asserting Z=1; add one asserting Z=0.
    mealy.transitions.push({ id: 't3', source: 's1', target: 's0', guard: { A: 0 }, outputs: { Z: 0 } });
    const { fsm, lossyStateLabels } = mealyToMoore(mealy);
    expect(lossyStateLabels).toEqual(['S1']);
    expect(fsm.states.find((s) => s.id === 's1')!.outputs).toEqual({});
  });
});
