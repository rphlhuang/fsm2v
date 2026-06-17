// ---------------------------------------------------------------------------
// Quine-McCluskey two-level logic minimization (+ Petrick's method) in plain
// TypeScript. Used to reduce next-state and output equations for the
// Structural Verilog export. The result is a sum-of-products kept deliberately
// simple and readable for students.
//
// Bit convention: variable index 0 is the most-significant bit, matching the
// rest of the app (inputs[0] is the MSB of a positional value).
// ---------------------------------------------------------------------------

import type { Bit } from '../model/types';

/** One literal of a product term: a variable forced to 0 or 1. */
export interface Literal {
  index: number; // variable index (0 = MSB)
  value: Bit;
}

/** AND of literals. Empty literals => constant 1. */
export interface ProductTerm {
  literals: Literal[];
}

/** OR of product terms. Empty => constant 0. */
export type SOP = ProductTerm[];

/** Above this many variables QM is too slow; fall back to canonical SOP. */
export const QM_VAR_LIMIT = 12;

interface Implicant {
  value: number; // value with dash positions cleared to 0
  mask: number; // bit = 1 where the variable is fixed (not a dash)
}

function popcount(x: number): number {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

function weight(index: number, numVars: number): number {
  return 1 << (numVars - 1 - index);
}

/** Does implicant `p` cover minterm `m`? */
function covers(p: Implicant, m: number): boolean {
  return (m & p.mask) === p.value;
}

const key = (p: Implicant) => `${p.value}/${p.mask}`;

/** Find all prime implicants of the given on-set ∪ don't-care set. */
function primeImplicants(terms: number[]): Implicant[] {
  let current: Implicant[] = [];
  const seen = new Set<string>();
  for (const t of terms) {
    const imp = { value: t, mask: -1 >>> 0 }; // all bits fixed
    if (!seen.has(key(imp))) {
      seen.add(key(imp));
      current.push(imp);
    }
  }

  const primes: Implicant[] = [];
  const primeSeen = new Set<string>();
  const addPrime = (p: Implicant) => {
    if (!primeSeen.has(key(p))) {
      primeSeen.add(key(p));
      primes.push(p);
    }
  };

  while (current.length > 0) {
    const combined = new Array<boolean>(current.length).fill(false);
    const nextMap = new Map<string, Implicant>();

    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const a = current[i];
        const b = current[j];
        if (a.mask !== b.mask) continue;
        const diff = a.value ^ b.value;
        if (popcount(diff) !== 1) continue;
        const newMask = a.mask & ~diff;
        const merged = { value: a.value & newMask, mask: newMask };
        nextMap.set(key(merged), merged);
        combined[i] = true;
        combined[j] = true;
      }
    }

    for (let i = 0; i < current.length; i++) {
      if (!combined[i]) addPrime(current[i]);
    }
    current = [...nextMap.values()];
  }

  return primes;
}

/** Petrick's method: minimal set of primes covering all required minterms. */
function petrick(primes: Implicant[], required: number[]): Implicant[] {
  // Product of sums: for each required minterm, OR of prime indices covering it.
  let products: Set<number>[] = [new Set()];
  for (const m of required) {
    const options: number[] = [];
    primes.forEach((p, idx) => {
      if (covers(p, m)) options.push(idx);
    });
    if (options.length === 0) continue; // unreachable if primes are complete

    const next: Set<number>[] = [];
    for (const prod of products) {
      for (const opt of options) {
        const combined = new Set(prod);
        combined.add(opt);
        next.push(combined);
      }
    }
    // Absorption: drop any product that is a superset of another (keep minimal).
    products = absorb(next);
  }

  // Pick the product with the fewest primes, then fewest total literals.
  let best: Set<number> | null = null;
  let bestScore = [Infinity, Infinity];
  for (const prod of products) {
    const lits = [...prod].reduce((s, idx) => s + popcount(primes[idx].mask), 0);
    const score = [prod.size, lits];
    if (score[0] < bestScore[0] || (score[0] === bestScore[0] && score[1] < bestScore[1])) {
      best = prod;
      bestScore = score;
    }
  }
  return best ? [...best].map((idx) => primes[idx]) : [];
}

/** Remove products that are supersets of another product (Petrick absorption). */
function absorb(products: Set<number>[]): Set<number>[] {
  const kept: Set<number>[] = [];
  for (const p of products) {
    if (kept.some((q) => isSubset(q, p))) continue; // p is redundant
    // remove any already-kept that are supersets of p
    for (let i = kept.length - 1; i >= 0; i--) {
      if (isSubset(p, kept[i])) kept.splice(i, 1);
    }
    kept.push(p);
  }
  return kept;
}

function isSubset(a: Set<number>, b: Set<number>): boolean {
  if (a.size > b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function implicantToTerm(p: Implicant, numVars: number): ProductTerm {
  const literals: Literal[] = [];
  for (let i = 0; i < numVars; i++) {
    const w = weight(i, numVars);
    if (p.mask & w) literals.push({ index: i, value: (p.value & w ? 1 : 0) as Bit });
  }
  return { literals };
}

/**
 * Minimize a boolean function given its on-set and don't-care set.
 * Returns a minimal sum-of-products. [] means constant 0;
 * [{literals: []}] means constant 1.
 */
export function minimize(
  numVars: number,
  minterms: Iterable<number>,
  dontCares: Iterable<number> = [],
): SOP {
  const onSet = [...new Set(minterms)];
  const dc = new Set(dontCares);
  const required = onSet.filter((m) => !dc.has(m));

  if (required.length === 0) return []; // constant 0

  if (numVars > QM_VAR_LIMIT) {
    // Fallback: canonical SOP (one full product term per required minterm).
    return required.map((m) => implicantToTerm({ value: m, mask: -1 >>> 0 }, numVars));
  }

  const primes = primeImplicants([...onSet, ...dc]);

  // Essential prime implicants: required minterms covered by exactly one prime.
  const chosen = new Set<number>();
  const stillNeeded = new Set(required);
  for (const m of required) {
    const coveringIdx: number[] = [];
    primes.forEach((p, idx) => {
      if (covers(p, m)) coveringIdx.push(idx);
    });
    if (coveringIdx.length === 1) chosen.add(coveringIdx[0]);
  }
  for (const idx of chosen) {
    for (const m of [...stillNeeded]) if (covers(primes[idx], m)) stillNeeded.delete(m);
  }

  // Cover whatever remains with Petrick over the not-yet-chosen primes.
  if (stillNeeded.size > 0) {
    const remainingPrimes = primes.filter((_, idx) => !chosen.has(idx));
    const extra = petrick(remainingPrimes, [...stillNeeded]);
    for (const p of extra) chosen.add(primes.indexOf(p));
  }

  return [...chosen].map((idx) => implicantToTerm(primes[idx], numVars));
}

/** Render a SOP to a Verilog boolean expression using the given variable names. */
export function sopToVerilog(sop: SOP, varNames: string[]): string {
  if (sop.length === 0) return "1'b0";
  const terms = sop.map((term) => {
    if (term.literals.length === 0) return "1'b1";
    const lits = term.literals.map((l) => (l.value ? varNames[l.index] : `~${varNames[l.index]}`));
    return lits.length === 1 ? lits[0] : `(${lits.join(' & ')})`;
  });
  // A single all-true term collapses to constant 1.
  if (terms.length === 1 && terms[0] === "1'b1") return "1'b1";
  return terms.join(' | ');
}
