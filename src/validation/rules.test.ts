import { describe, expect, it } from 'vitest';
import { validateFSM } from './rules';
import type { FSM } from '../model/types';

function toggleFSM(): FSM {
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
      { id: 't1', source: 's0', target: 's0', guard: { A: 0 }, outputs: {} },
      { id: 't2', source: 's0', target: 's1', guard: { A: 1 }, outputs: {} },
      { id: 't3', source: 's1', target: 's1', guard: { A: 0 }, outputs: {} },
      { id: 't4', source: 's1', target: 's0', guard: { A: 1 }, outputs: {} },
    ],
  };
}

const byId = (fsm: FSM, id: string) => validateFSM(fsm).find((r) => r.id === id)!;

describe('validateFSM', () => {
  it('passes all four rules for a complete toggle FSM', () => {
    for (const r of validateFSM(toggleFSM())) expect(r.pass).toBe(true);
  });

  it('flags an incompletely specified state', () => {
    const fsm = toggleFSM();
    fsm.transitions = fsm.transitions.filter((t) => t.id !== 't1'); // drop S0 on A=0
    expect(byId(fsm, 'complete').pass).toBe(false);
  });

  it('flags overlapping (non-unique) transitions', () => {
    const fsm = toggleFSM();
    fsm.transitions.push({ id: 't5', source: 's0', target: 's1', guard: { A: 0 }, outputs: {} });
    expect(byId(fsm, 'unique').pass).toBe(false);
  });

  it('flags a missing reset state', () => {
    const fsm = toggleFSM();
    fsm.config.resetStateId = null;
    expect(byId(fsm, 'reset').pass).toBe(false);
  });

  it('flags outputs on a Mealy state (impure notation)', () => {
    const fsm = toggleFSM();
    fsm.config.type = 'mealy';
    expect(byId(fsm, 'pure').pass).toBe(false); // states still carry outputs
  });
});
