// ---------------------------------------------------------------------------
// State encoding shared by both Verilog styles.
//
// The reset state is always placed at index 0. For BINARY encoding that gives
// it code 0 (so every flip-flop simply resets to 0). For ONE-HOT it gets
// code 1 (only its own bit set).
// ---------------------------------------------------------------------------

import type { Encoding, FSM, FSMState } from '../model/types';

export interface StateCode {
  state: FSMState;
  index: number; // 0 = reset state
  code: number; // numeric value of the Q register for this state
  bits: string; // MSB-first binary string, length = numBits
}

export interface EncodingInfo {
  encoding: Encoding;
  numBits: number;
  codes: StateCode[]; // reset state first
  byId: Map<string, StateCode>;
  /** Q-register variable names, MSB-first (Q[nb-1] .. Q[0]) for QM var arrays. */
  stateVarNames: string[];
}

/** Order states with the reset state first, then by current array order. */
function orderedStates(fsm: FSM): FSMState[] {
  const reset = fsm.states.find((s) => s.id === fsm.config.resetStateId);
  if (!reset) return fsm.states;
  return [reset, ...fsm.states.filter((s) => s.id !== reset.id)];
}

function toBits(code: number, numBits: number): string {
  let s = '';
  for (let b = numBits - 1; b >= 0; b--) s += (code >> b) & 1;
  return s;
}

export function buildEncoding(fsm: FSM): EncodingInfo {
  const ordered = orderedStates(fsm);
  const n = ordered.length;
  const encoding = fsm.config.encoding;

  const numBits =
    encoding === 'one-hot' ? Math.max(1, n) : Math.max(1, Math.ceil(Math.log2(Math.max(1, n))));

  const codes: StateCode[] = ordered.map((state, index) => {
    const code = encoding === 'one-hot' ? 1 << index : index;
    return { state, index, code, bits: toBits(code, numBits) };
  });

  const byId = new Map(codes.map((c) => [c.state.id, c]));

  // MSB-first Q-bit names. Binary: Q[nb-1..0]. One-hot: q_<label> per bit.
  const stateVarNames: string[] = [];
  for (let p = numBits - 1; p >= 0; p--) {
    if (encoding === 'one-hot') {
      const owner = codes.find((c) => c.index === p);
      stateVarNames.push(`q_${owner ? owner.state.label : p}`);
    } else {
      stateVarNames.push(`Q[${p}]`);
    }
  }

  return { encoding, numBits, codes, byId, stateVarNames };
}
