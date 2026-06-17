import { describe, expect, it } from 'vitest';
import { generateBehavioral } from './behavioral';
import { generateStructural } from './structural';
import type { FSM } from '../model/types';

// Moore "1101 detector"-style toggle: two states, input A, output Z.
function fsm(overrides: Partial<FSM['config']> = {}): FSM {
  return {
    config: {
      type: 'moore',
      inputs: ['A'],
      outputs: ['Z'],
      resetStateId: 's0',
      encoding: 'binary',
      style: 'behavioral',
      notation: 'named',
      ...overrides,
    },
    states: [
      { id: 's0', label: 'S0', position: { x: 0, y: 0 }, outputs: { Z: 0 } },
      { id: 's1', label: 'S1', position: { x: 0, y: 0 }, outputs: { Z: 1 } },
    ],
    transitions: [
      { id: 't1', source: 's0', target: 's0', guard: { A: 0 }, outputs: {} },
      { id: 't2', source: 's0', target: 's1', guard: { A: 1 }, outputs: {} },
      { id: 't3', source: 's1', target: 's1', guard: { A: 1 }, outputs: {} },
      { id: 't4', source: 's1', target: 's0', guard: { A: 0 }, outputs: {} },
    ],
  };
}

describe('behavioral codegen', () => {
  it('emits a three-block FSM with case statements and traced comments', () => {
    const v = generateBehavioral(fsm()).code;
    expect(v).toContain('module fsm');
    expect(v).toContain('case (state)');
    expect(v).toContain('next_state = S1;');
    expect(v).toContain('S0 -> S1 when A=1'); // comment tracing to the diagram
    expect(v).toContain('endmodule');
  });
});

describe('structural codegen', () => {
  it('instantiates FDRE flops and assigns minimized SOP (binary)', () => {
    const v = generateStructural(fsm({ style: 'structural',
      notation: 'named', encoding: 'binary' })).code;
    expect(v).toContain('FDRE #(.INIT(1\'b0))');
    expect(v).toContain('.C(clk)');
    expect(v).toContain('.CE(1\'b1)');
    expect(v).toMatch(/assign D\[0\] =/);
    expect(v).toContain('assign Z =');
  });

  it('uses an FDSE for the reset bit in one-hot encoding', () => {
    const v = generateStructural(fsm({ style: 'structural',
      notation: 'named', encoding: 'one-hot' })).code;
    expect(v).toContain('FDSE #(.INIT(1\'b1))'); // reset state's own bit
    expect(v).toContain('FDRE #(.INIT(1\'b0))');
    expect(v).toMatch(/assign d_S\d? =/);
  });
});
