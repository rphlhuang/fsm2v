import { describe, expect, it } from 'vitest';
import { parseSide, parseEdgeLabel } from './parseLabel';
import type { FSMConfig } from '../model/types';

describe('parseSide', () => {
  it('parses a positional bit string', () => {
    const r = parseSide('010', ['in2', 'in1', 'in0']);
    expect(r).toEqual({ ok: true, value: { in2: 0, in1: 1, in0: 0 } });
  });

  it('rejects a positional value of the wrong length', () => {
    const r = parseSide('10', ['A', 'B', 'C']);
    expect(r.ok).toBe(false);
  });

  it('parses concatenated single-letter named signals (AB)', () => {
    const r = parseSide('AB', ['A', 'B']);
    expect(r).toEqual({ ok: true, value: { A: 1, B: 1 } });
  });

  it('parses an inverted single signal (!F)', () => {
    const r = parseSide('!F', ['F']);
    expect(r).toEqual({ ok: true, value: { F: 0 } });
  });

  it('parses comma-separated multi-letter named signals', () => {
    const r = parseSide('!LA, LB, !E', ['LA', 'LB', 'E']);
    expect(r).toEqual({ ok: true, value: { LA: 0, LB: 1, E: 0 } });
  });

  it('treats omitted named inputs as don\'t-care (sparse)', () => {
    const r = parseSide('LA', ['LA', 'LB', 'E']);
    expect(r.ok && r.value).toEqual({ LA: 1 });
  });

  it('matches the longest signal name first', () => {
    const r = parseSide('LA', ['L', 'A', 'LA']);
    expect(r.ok && r.value).toEqual({ LA: 1 });
  });

  it('rejects an unknown signal', () => {
    const r = parseSide('Q', ['A', 'B']);
    expect(r.ok).toBe(false);
  });

  it('returns an empty assignment for empty text', () => {
    expect(parseSide('', ['A'])).toEqual({ ok: true, value: {} });
  });

  it('treats "-" as a don\'t-care position in a positional value', () => {
    const r = parseSide('1-0', ['A', 'B', 'C']);
    expect(r.ok && r.value).toEqual({ A: 1, C: 0 });
  });

  it('parses an all-don\'t-care positional value', () => {
    const r = parseSide('--', ['A', 'B']);
    expect(r.ok && r.value).toEqual({});
  });
});

const mealy: FSMConfig = {
  type: 'mealy',
  inputs: ['A', 'B'],
  outputs: ['X'],
  resetStateId: null,
  encoding: 'binary',
  style: 'behavioral',
      notation: 'named',
};

describe('parseEdgeLabel', () => {
  it('splits a Mealy label into guard and outputs', () => {
    const r = parseEdgeLabel('10 / 1', mealy);
    expect(r).toEqual({ ok: true, value: { guard: { A: 1, B: 0 }, outputs: { X: 1 } } });
  });

  it('rejects outputs on a Moore arc', () => {
    const r = parseEdgeLabel('1 / 1', { ...mealy, type: 'moore', inputs: ['A'] });
    expect(r.ok).toBe(false);
  });
});
