// ---------------------------------------------------------------------------
// Core FSM data model.
//
// The entire application state revolves around a single canonical FSM model
// (FSMConfig + State[] + Transition[]). React Flow nodes/edges are *views*
// derived from this model; they hold only ids + positions and point back here.
// Validation, Verilog generation, and logic minimization all read this model,
// so there is exactly one source of truth for "what the machine does".
// ---------------------------------------------------------------------------

/** A single-bit logic value. Inverted signals (rendered with an overbar) are 0. */
export type Bit = 0 | 1;

/**
 * A partial assignment over a set of named signals.
 *   - present key  -> that signal is constrained to 0 or 1
 *   - absent key   -> that signal is a "don't care"
 *
 * This single representation underlies BOTH label dialects taught in class:
 *   - positional ("010") -> every input present
 *   - named/sparse ("LA, !E") -> only the listed inputs present, rest don't-care
 */
export type Assignment = Record<string, Bit>;

export type MachineType = 'mealy' | 'moore';
export type Encoding = 'one-hot' | 'binary';
export type CodeStyle = 'behavioral' | 'structural';
/** How labels are *displayed*: positional bits ("010") vs named signals ("A, !B"). */
export type Notation = 'positional' | 'named';

export interface FSMConfig {
  /** Mealy (outputs on edges) vs Moore (outputs in state bubbles). */
  type: MachineType;
  /** Ordered input signal names. Order defines the positional bit order. */
  inputs: string[];
  /** Ordered output signal names. */
  outputs: string[];
  /** Id of the designated reset/initial state, or null if none chosen. */
  resetStateId: string | null;
  /** State-bit encoding used for Verilog export. */
  encoding: Encoding;
  /** Behavioral vs Structural Verilog. */
  style: CodeStyle;
  /** Display dialect for on-canvas labels (does not affect the model). */
  notation: Notation;
}

export interface FSMState {
  id: string;
  /** Human label, e.g. "S0". Used as the Verilog state name. */
  label: string;
  position: { x: number; y: number };
  /**
   * Moore outputs asserted while in this state (rendered in the bubble's
   * bottom half). Absent output name => 0. Ignored in Mealy mode.
   */
  outputs: Assignment;
}

export interface Transition {
  id: string;
  /** Source state id. */
  source: string;
  /** Target state id. */
  target: string;
  /**
   * Which side-handle the arc leaves from / arrives at ("top" | "right" |
   * "bottom" | "left"). Purely presentational — lets the user route arcs around
   * each other. Absent => let the renderer pick a default.
   */
  sourceHandle?: string | null;
  targetHandle?: string | null;
  /** Input condition for taking this arc (partial assignment, see Assignment). */
  guard: Assignment;
  /**
   * Mealy outputs asserted on this arc. Absent output name => 0.
   * Ignored in Moore mode.
   */
  outputs: Assignment;
}

/** The full canonical machine, as consumed by validation / codegen. */
export interface FSM {
  config: FSMConfig;
  states: FSMState[];
  transitions: Transition[];
}
