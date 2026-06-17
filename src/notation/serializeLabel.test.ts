import { describe, expect, it } from 'vitest';
import { serializeSide } from './serializeLabel';

describe('serializeSide', () => {
  it('named: shows only constrained signals with "!" for inverted', () => {
    expect(serializeSide({ A: 0, B: 1 }, ['A', 'B', 'C'], 'named')).toBe('!A, B');
  });

  it('named: keeps a fully-specified assignment named (no positional coercion)', () => {
    // Regression: typing "!A, B" must not snap back to "01".
    expect(serializeSide({ A: 0, B: 1 }, ['A', 'B'], 'named')).toBe('!A, B');
  });

  it('positional: renders bits, with absent inputs as "-"', () => {
    expect(serializeSide({ A: 1, C: 0 }, ['A', 'B', 'C'], 'positional', '-')).toBe('1-0');
  });

  it('positional: renders absent outputs as "0"', () => {
    expect(serializeSide({ Y: 1 }, ['X', 'Y'], 'positional', '0')).toBe('01');
  });
});
