import { describe, expect, it } from 'vitest';
import { minimize, sopToVerilog } from './quineMcCluskey';

describe('quineMcCluskey', () => {
  it('reduces f = A (over [A,B]) to a single literal', () => {
    // A is MSB (weight 2): on-set {2,3}.
    const sop = minimize(2, [2, 3]);
    expect(sopToVerilog(sop, ['A', 'B'])).toBe('A');
  });

  it('returns constant 0 for an empty on-set', () => {
    expect(sopToVerilog(minimize(2, []), ['A', 'B'])).toBe("1'b0");
  });

  it('returns constant 1 when all minterms are set', () => {
    expect(sopToVerilog(minimize(2, [0, 1, 2, 3]), ['A', 'B'])).toBe("1'b1");
  });

  it('uses don\'t-cares to simplify', () => {
    // on {3}, dc {2}: both have A=1, so f minimizes to A.
    const sop = minimize(2, [3], [2]);
    expect(sopToVerilog(sop, ['A', 'B'])).toBe('A');
  });

  it('produces a correct cover for XOR (no simplification possible)', () => {
    // f = A^B over [A,B]: minterms 1 (B) and 2 (A).
    const sop = minimize(2, [1, 2]);
    // Evaluate the cover against the truth table to confirm correctness.
    const evalSop = (a: number, b: number) =>
      sop.some((term) =>
        term.literals.every((l) => {
          const bit = l.index === 0 ? a : b;
          return bit === l.value;
        }),
      );
    expect(evalSop(0, 0)).toBe(false);
    expect(evalSop(0, 1)).toBe(true);
    expect(evalSop(1, 0)).toBe(true);
    expect(evalSop(1, 1)).toBe(false);
  });
});
