import { describe, expect, it } from 'vitest';
import { parseFSMFile, serializeFSM } from './fsmFile';
import type { FSM } from '../model/types';

const sample: FSM = {
  config: {
    type: 'mealy',
    inputs: ['A', 'B'],
    outputs: ['Z'],
    resetStateId: 'state_1',
    encoding: 'one-hot',
    style: 'structural',
    notation: 'named',
  },
  states: [
    { id: 'state_1', label: 'S0', position: { x: 10, y: 20 }, outputs: { Z: 1 } },
    { id: 'state_2', label: 'S1', position: { x: 100, y: 60 }, outputs: {} },
  ],
  transitions: [
    {
      id: 't_1',
      source: 'state_1',
      target: 'state_2',
      sourceHandle: 'right',
      targetHandle: 'left',
      guard: { A: 1 },
      outputs: { Z: 0 },
    },
  ],
};

describe('fsmFile', () => {
  it('round-trips an FSM through serialize/parse', () => {
    const res = parseFSMFile(serializeFSM(sample));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.fsm).toEqual(sample);
  });

  it('rejects non-JSON', () => {
    const res = parseFSMFile('not json {');
    expect(res).toEqual({ ok: false, error: 'Not a valid JSON file.' });
  });

  it('rejects a foreign JSON file', () => {
    const res = parseFSMFile(JSON.stringify({ hello: 'world' }));
    expect(res).toEqual({ ok: false, error: 'Not an fsm2v file.' });
  });

  it('rejects a structurally invalid machine', () => {
    const bad = JSON.stringify({ app: 'fsm2v', version: 1, fsm: { config: {}, states: [], transitions: [] } });
    const res = parseFSMFile(bad);
    expect(res.ok).toBe(false);
  });

  it('rejects states with the wrong shape', () => {
    const bad = JSON.stringify({
      app: 'fsm2v',
      version: 1,
      fsm: { ...sample, states: [{ id: 'x' }] },
    });
    const res = parseFSMFile(bad);
    expect(res.ok).toBe(false);
  });
});
