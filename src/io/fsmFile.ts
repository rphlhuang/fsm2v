// Serialize / deserialize the canonical FSM model to a portable file.
//
// The whole machine (config + states + transitions, positions included) lives in
// the model, so a round-trip is just JSON of `selectFSM(...)` wrapped in a small
// envelope that tags the app and a schema version. `parseFSMFile` validates the
// envelope and shape so a bad/foreign file fails loudly instead of corrupting
// the canvas.

import type {
  Assignment,
  CodeStyle,
  Encoding,
  FSM,
  FSMState,
  MachineType,
  Notation,
  Transition,
} from '../model/types';

const APP_TAG = 'fsm2v';
const VERSION = 1;

interface FSMFile {
  app: typeof APP_TAG;
  version: number;
  fsm: FSM;
}

export function serializeFSM(fsm: FSM): string {
  const file: FSMFile = { app: APP_TAG, version: VERSION, fsm };
  return JSON.stringify(file, null, 2);
}

export type ParseResult =
  | { ok: true; fsm: FSM }
  | { ok: false; error: string };

export function parseFSMFile(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not a valid JSON file.' };
  }
  if (!isRecord(raw) || raw.app !== APP_TAG) {
    return { ok: false, error: 'Not an fsm2v file.' };
  }
  const fsm = (raw as Record<string, unknown>).fsm;
  const validated = validateFSM(fsm);
  if (!validated.ok) return validated;
  return { ok: true, fsm: validated.fsm };
}

function validateFSM(value: unknown): ParseResult {
  if (!isRecord(value)) return fail('missing fsm');
  const { config, states, transitions } = value as Record<string, unknown>;
  const cfg = validateConfig(config);
  if (!cfg.ok) return cfg;
  if (!Array.isArray(states) || !states.every(isValidState)) {
    return fail('invalid states');
  }
  if (!Array.isArray(transitions) || !transitions.every(isValidTransition)) {
    return fail('invalid transitions');
  }
  return {
    ok: true,
    fsm: {
      config: cfg.config,
      states: states as FSMState[],
      transitions: transitions as Transition[],
    },
  };
}

const MACHINE_TYPES: MachineType[] = ['mealy', 'moore'];
const ENCODINGS: Encoding[] = ['one-hot', 'binary'];
const STYLES: CodeStyle[] = ['behavioral', 'structural'];
const NOTATIONS: Notation[] = ['positional', 'named'];

function validateConfig(
  value: unknown,
): { ok: true; config: FSM['config'] } | { ok: false; error: string } {
  if (!isRecord(value)) return fail('missing config');
  const c = value as Record<string, unknown>;
  if (!MACHINE_TYPES.includes(c.type as MachineType)) return fail('invalid config.type');
  if (!ENCODINGS.includes(c.encoding as Encoding)) return fail('invalid config.encoding');
  if (!STYLES.includes(c.style as CodeStyle)) return fail('invalid config.style');
  if (!NOTATIONS.includes(c.notation as Notation)) return fail('invalid config.notation');
  if (!isStringArray(c.inputs)) return fail('invalid config.inputs');
  if (!isStringArray(c.outputs)) return fail('invalid config.outputs');
  if (c.resetStateId !== null && typeof c.resetStateId !== 'string') {
    return fail('invalid config.resetStateId');
  }
  return {
    ok: true,
    config: {
      type: c.type as MachineType,
      inputs: c.inputs as string[],
      outputs: c.outputs as string[],
      resetStateId: (c.resetStateId as string | null) ?? null,
      encoding: c.encoding as Encoding,
      style: c.style as CodeStyle,
      notation: c.notation as Notation,
    },
  };
}

function isValidState(s: unknown): boolean {
  if (!isRecord(s)) return false;
  return (
    typeof s.id === 'string' &&
    typeof s.label === 'string' &&
    isRecord(s.position) &&
    typeof s.position.x === 'number' &&
    typeof s.position.y === 'number' &&
    isAssignment(s.outputs)
  );
}

function isValidTransition(t: unknown): boolean {
  if (!isRecord(t)) return false;
  return (
    typeof t.id === 'string' &&
    typeof t.source === 'string' &&
    typeof t.target === 'string' &&
    isAssignment(t.guard) &&
    isAssignment(t.outputs)
  );
}

function isAssignment(value: unknown): value is Assignment {
  if (!isRecord(value)) return false;
  return Object.values(value).every((v) => v === 0 || v === 1);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(what: string): { ok: false; error: string } {
  return { ok: false, error: `Malformed fsm2v file (${what}).` };
}
