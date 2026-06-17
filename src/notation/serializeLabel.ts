// ---------------------------------------------------------------------------
// Serialization: structured Assignment -> text, for three purposes:
//   - serializeSide:   an editable, re-parseable string for the text inputs
//   - sideTokens:      dialect-aware tokens for on-canvas display (overbars)
//   - describeAssignment: plain ASCII "A=1, B=0" for Verilog comments
// ---------------------------------------------------------------------------

import type { Assignment, Bit, Notation } from '../model/types';

/** Present signals, in declared order. */
function presentNames(assignment: Assignment, names: string[]): string[] {
  return names.filter((n) => n in assignment);
}

/**
 * Editable text for a side, in the requested display dialect.
 *   - positional -> bit string ("010"); absent signals shown as `absentChar`
 *     ("-" for don't-care inputs, "0" for outputs).
 *   - named      -> comma-separated named form with "!" for inverted ("!LA, LB").
 */
export function serializeSide(
  assignment: Assignment,
  names: string[],
  notation: Notation = 'named',
  absentChar = '-',
): string {
  if (notation === 'positional') {
    if (names.length === 0) return '';
    return names.map((n) => (n in assignment ? assignment[n] : absentChar)).join('');
  }
  return presentNames(assignment, names)
    .map((n) => (assignment[n] === 0 ? `!${n}` : n))
    .join(', ');
}

export interface SideToken {
  name: string; // shown text for this token: a bit, or a signal name
  inverted: boolean; // render with an overbar
}

export interface SideRender {
  dialect: 'positional' | 'named' | 'empty';
  tokens: SideToken[];
  /** Separator to place between tokens when rendering. */
  separator: string;
}

/**
 * Dialect-aware tokens for canvas display, honoring the chosen notation.
 * Positional shows plain bits (absent => `absentChar`); named shows signal
 * names with overbars on inverted ones. Single-letter named signals are
 * concatenated (class style: "AB"); multi-letter use ", ".
 */
export function sideTokens(
  assignment: Assignment,
  names: string[],
  notation: Notation = 'named',
  absentChar = '-',
): SideRender {
  const present = presentNames(assignment, names);

  if (notation === 'positional') {
    // Nothing constrained and absences are don't-cares => show nothing.
    if (names.length === 0 || (present.length === 0 && absentChar === '-')) {
      return { dialect: 'empty', tokens: [], separator: '' };
    }
    return {
      dialect: 'positional',
      tokens: names.map((n) => ({
        name: n in assignment ? String(assignment[n]) : absentChar,
        inverted: false,
      })),
      separator: '',
    };
  }

  if (present.length === 0) return { dialect: 'empty', tokens: [], separator: '' };
  const allSingleChar = present.every((n) => n.length === 1);
  return {
    dialect: 'named',
    tokens: present.map((n) => ({ name: n, inverted: assignment[n] === 0 })),
    separator: allSingleChar ? '' : ', ',
  };
}

/** Plain ASCII description for Verilog comments, e.g. "A=1, B=0" or "(any)". */
export function describeAssignment(
  assignment: Assignment,
  names: string[],
  emptyText = '(any)',
): string {
  const present = presentNames(assignment, names);
  if (present.length === 0) return emptyText;
  return present.map((n) => `${n}=${assignment[n] as Bit}`).join(', ');
}
