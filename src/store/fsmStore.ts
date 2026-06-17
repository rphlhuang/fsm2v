// ---------------------------------------------------------------------------
// Zustand store: the single source of truth for the FSM.
//
// Components subscribe to slices of this store; the canvas, checklist, and
// code panel all re-render from here. Mealy/Moore conversion runs through
// `requestType` which silently applies lossless conversions and stages lossy
// ones behind a confirmation dialog.
// ---------------------------------------------------------------------------

import { create } from 'zustand';
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
import { mealyToMoore, mooreToMealy } from '../model/convert';

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}_${++idCounter}`;

interface PendingConversion {
  to: MachineType;
  lossyStateLabels: string[];
  /** The already-computed target FSM to commit if the user confirms. */
  fsm: FSM;
}

interface FSMStore extends FSM {
  /** Currently selected node/edge id (for the inspector / delete). */
  selectedId: string | null;
  /** Staged lossy conversion awaiting user confirmation, or null. */
  pendingConversion: PendingConversion | null;
  /** I/O setup dialog: open flag + which view it shows. */
  setupOpen: boolean;
  setupView: 'choose' | 'table';

  // --- selection ---
  select: (id: string | null) => void;
  openSetup: (view: 'choose' | 'table') => void;
  closeSetup: () => void;

  // --- config ---
  requestType: (type: MachineType) => void;
  confirmConversion: () => void;
  cancelConversion: () => void;
  setEncoding: (encoding: Encoding) => void;
  setStyle: (style: CodeStyle) => void;
  setNotation: (notation: Notation) => void;
  setInputs: (inputs: string[]) => void;
  setOutputs: (outputs: string[]) => void;
  setResetState: (id: string | null) => void;

  // --- states ---
  addState: (position: { x: number; y: number }) => string;
  updateState: (id: string, patch: Partial<FSMState>) => void;
  moveState: (id: string, position: { x: number; y: number }) => void;
  setStateOutputs: (id: string, outputs: Assignment) => void;
  removeState: (id: string) => void;

  // --- transitions ---
  addTransition: (
    source: string,
    target: string,
    sourceHandle?: string | null,
    targetHandle?: string | null,
  ) => string;
  updateTransition: (id: string, patch: Partial<Transition>) => void;
  removeTransition: (id: string) => void;
}

export const useFSMStore = create<FSMStore>((set, get) => ({
  config: {
    type: 'moore',
    inputs: ['A'],
    outputs: ['Z'],
    resetStateId: null,
    encoding: 'binary',
    style: 'behavioral',
    notation: 'named',
  },
  states: [],
  transitions: [],
  selectedId: null,
  pendingConversion: null,
  setupOpen: true,
  setupView: 'choose',

  select: (id) => set({ selectedId: id }),
  openSetup: (view) => set({ setupOpen: true, setupView: view }),
  closeSetup: () => set({ setupOpen: false }),

  requestType: (type) => {
    const fsm = get() as FSM;
    if (fsm.config.type === type) return;

    if (type === 'mealy') {
      // Moore -> Mealy is always lossless: apply immediately.
      const next = mooreToMealy(fsm);
      set({ config: next.config, states: next.states, transitions: next.transitions });
      return;
    }

    // Mealy -> Moore: detect conflicts.
    const { fsm: next, lossyStateLabels } = mealyToMoore(fsm);
    if (lossyStateLabels.length === 0) {
      set({ config: next.config, states: next.states, transitions: next.transitions });
    } else {
      // Stage behind the confirmation dialog instead of mutating now.
      set({ pendingConversion: { to: type, lossyStateLabels, fsm: next } });
    }
  },

  confirmConversion: () => {
    const pending = get().pendingConversion;
    if (!pending) return;
    set({
      config: pending.fsm.config,
      states: pending.fsm.states,
      transitions: pending.fsm.transitions,
      pendingConversion: null,
    });
  },

  cancelConversion: () => set({ pendingConversion: null }),

  setEncoding: (encoding) => set((s) => ({ config: { ...s.config, encoding } })),
  setStyle: (style) => set((s) => ({ config: { ...s.config, style } })),
  setNotation: (notation) => set((s) => ({ config: { ...s.config, notation } })),

  setInputs: (inputs) => set((s) => ({ config: { ...s.config, inputs } })),
  setOutputs: (outputs) => set((s) => ({ config: { ...s.config, outputs } })),
  setResetState: (id) => set((s) => ({ config: { ...s.config, resetStateId: id } })),

  addState: (position) => {
    const id = nextId('state');
    set((s) => {
      const label = `S${s.states.length}`;
      const isFirst = s.states.length === 0;
      return {
        states: [...s.states, { id, label, position, outputs: {} }],
        // First state created becomes the reset state by default.
        config: isFirst ? { ...s.config, resetStateId: id } : s.config,
      };
    });
    return id;
  },

  updateState: (id, patch) =>
    set((s) => ({
      states: s.states.map((st) => (st.id === id ? { ...st, ...patch } : st)),
    })),

  moveState: (id, position) =>
    set((s) => ({
      states: s.states.map((st) => (st.id === id ? { ...st, position } : st)),
    })),

  setStateOutputs: (id, outputs) =>
    set((s) => ({
      states: s.states.map((st) => (st.id === id ? { ...st, outputs } : st)),
    })),

  removeState: (id) =>
    set((s) => ({
      states: s.states.filter((st) => st.id !== id),
      transitions: s.transitions.filter((t) => t.source !== id && t.target !== id),
      config:
        s.config.resetStateId === id
          ? { ...s.config, resetStateId: null }
          : s.config,
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  addTransition: (source, target, sourceHandle, targetHandle) => {
    const id = nextId('t');
    set((s) => ({
      transitions: [
        ...s.transitions,
        { id, source, target, sourceHandle, targetHandle, guard: {}, outputs: {} },
      ],
    }));
    return id;
  },

  updateTransition: (id, patch) =>
    set((s) => ({
      transitions: s.transitions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  removeTransition: (id) =>
    set((s) => ({
      transitions: s.transitions.filter((t) => t.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),
}));

/** Convenience selector returning just the canonical FSM (for codegen/validation). */
export const selectFSM = (s: FSMStore): FSM => ({
  config: s.config,
  states: s.states,
  transitions: s.transitions,
});
