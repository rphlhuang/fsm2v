import { describe, expect, it } from 'vitest';
import { guardToMinterms, fullMintermSet } from './minterms';

describe('guardToMinterms', () => {
  it('fans out a don\'t-care input', () => {
    // inputs [A,B]: A is MSB (weight 2). A=1 with B free -> {2,3}.
    expect(guardToMinterms({ A: 1 }, ['A', 'B'])).toEqual(new Set([2, 3]));
  });

  it('covers a single minterm when fully specified', () => {
    expect(guardToMinterms({ A: 1, B: 0 }, ['A', 'B'])).toEqual(new Set([2]));
  });

  it('covers the whole space when everything is a don\'t-care', () => {
    expect(guardToMinterms({}, ['A', 'B'])).toEqual(fullMintermSet(2));
  });
});
