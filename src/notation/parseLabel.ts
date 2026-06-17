// ---------------------------------------------------------------------------
// Label parser. Turns the text students type into structured Assignments.
//
// Two dialects are supported, matching how the class writes FSMs:
//
//   1. Positional / implied names  -- a contiguous bit string, ALWAYS fully
//      specified: "010", "1", "11".  Each bit maps to a signal in order.
//
//   2. Named / sparse  -- explicit signal names, "!" marks an inverted signal.
//      Tokens may be comma/space separated ("!LA, LB, !E") OR, when the signals
//      are single letters, concatenated ("AB", "!F", "AB" == A=1,B=1).
//      Any signal NOT mentioned is a don't-care (inputs) / 0 (outputs).
//
// Full edge labels are "inputs / outputs" (Mealy) or just "inputs" (Moore).
// ---------------------------------------------------------------------------

import type { Assignment, Bit, FSMConfig } from '../model/types';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): ParseResult<T> => ({ ok: true, value });
const err = (error: string): ParseResult<never> => ({ ok: false, error });

/**
 * Parse one side of a label (just the inputs, or just the outputs) against a
 * known, ordered list of signal names.
 */
export function parseSide(text: string, names: string[]): ParseResult<Assignment> {
  const trimmed = text.trim();
  if (trimmed === '') return ok({}); // empty side: all don't-care / all-zero

  // --- Dialect 1: positional bit string ---------------------------------
  // "-" marks a don't-care position (left absent from the assignment).
  if (/^[01-]+$/.test(trimmed)) {
    if (trimmed.length !== names.length) {
      return err(
        `Positional value "${trimmed}" has ${trimmed.length} bit(s) but there are ${names.length} signal(s) (${names.join(', ')}).`,
      );
    }
    const assignment: Assignment = {};
    for (let i = 0; i < names.length; i++) {
      if (trimmed[i] === '-') continue; // don't-care: leave absent
      assignment[names[i]] = Number(trimmed[i]) as Bit;
    }
    return ok(assignment);
  }

  // --- Dialect 2: named (comma/space separated and/or concatenated) ------
  // Strip separators; tokens are self-delimiting via longest-name matching.
  const s = trimmed.replace(/[,\s]+/g, '');
  const assignment: Assignment = {};
  let i = 0;
  // Match longest known name first so "LA" wins over "L" + "A".
  const sorted = [...names].sort((a, b) => b.length - a.length);

  while (i < s.length) {
    let inverted = false;
    if (s[i] === '!' || s[i] === '~') {
      inverted = true;
      i++;
    }
    const name = sorted.find((n) => s.startsWith(n, i));
    if (!name) {
      return err(
        `Unrecognized signal near "${s.slice(i)}". Known signals: ${names.join(', ') || '(none)'}.`,
      );
    }
    const value: Bit = inverted ? 0 : 1;
    if (name in assignment && assignment[name] !== value) {
      return err(`Signal "${name}" is given conflicting values in the same label.`);
    }
    assignment[name] = value;
    i += name.length;
  }
  return ok(assignment);
}

/** Parse a transition (edge) label into a guard and (Mealy) outputs. */
export function parseEdgeLabel(
  text: string,
  config: FSMConfig,
): ParseResult<{ guard: Assignment; outputs: Assignment }> {
  const slash = text.indexOf('/');

  if (config.type === 'moore') {
    if (slash >= 0) {
      return err('Moore arcs carry inputs only — outputs belong in the state bubble.');
    }
    const guard = parseSide(text, config.inputs);
    if (!guard.ok) return guard;
    return ok({ guard: guard.value, outputs: {} });
  }

  // Mealy: "inputs / outputs"
  const inputPart = slash >= 0 ? text.slice(0, slash) : text;
  const outputPart = slash >= 0 ? text.slice(slash + 1) : '';

  const guard = parseSide(inputPart, config.inputs);
  if (!guard.ok) return guard;
  const outputs = parseSide(outputPart, config.outputs);
  if (!outputs.ok) return outputs;
  return ok({ guard: guard.value, outputs: outputs.value });
}

/** Parse the outputs typed into a Moore state bubble. */
export function parseStateOutputs(text: string, config: FSMConfig): ParseResult<Assignment> {
  return parseSide(text, config.outputs);
}
