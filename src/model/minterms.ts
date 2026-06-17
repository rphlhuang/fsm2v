// ---------------------------------------------------------------------------
// Minterm expansion -- the shared primitive behind both FSM validation and
// the Quine-McCluskey minimizer.
//
// A guard is a partial assignment over the inputs; this expands it to the set
// of full input combinations (minterms) it covers, fanning out don't-cares.
//
// Bit convention: inputs[0] is the most-significant bit. This matches the
// positional dialect, where the first character of "010" is inputs[0].
// ---------------------------------------------------------------------------

import type { Assignment } from './types';

/** Weight (place value) of inputs[i] given a total of n inputs. */
export function inputWeight(i: number, n: number): number {
  return 1 << (n - 1 - i);
}

/** Expand a partial assignment over `inputs` into the minterms it covers. */
export function guardToMinterms(guard: Assignment, inputs: string[]): Set<number> {
  let partials = [0];
  for (let i = 0; i < inputs.length; i++) {
    const w = inputWeight(i, inputs.length);
    const name = inputs[i];
    if (name in guard) {
      const bit = guard[name];
      partials = partials.map((p) => (bit ? p | w : p));
    } else {
      // Don't-care: fan out both 0 and 1 for this bit.
      const next: number[] = [];
      for (const p of partials) {
        next.push(p);
        next.push(p | w);
      }
      partials = next;
    }
  }
  return new Set(partials);
}

/** The complete minterm universe for `n` inputs: {0 .. 2^n - 1}. */
export function fullMintermSet(n: number): Set<number> {
  const set = new Set<number>();
  for (let i = 0; i < 1 << n; i++) set.add(i);
  return set;
}

/** Render a minterm index as a positional bit string over `inputs`. */
export function mintermToBits(m: number, inputs: string[]): string {
  let s = '';
  for (let i = 0; i < inputs.length; i++) {
    s += (m & inputWeight(i, inputs.length)) ? '1' : '0';
  }
  return s || '(no inputs)';
}
