import type { FSM } from '../model/types';
import { generateBehavioral } from './behavioral';
import { generateStructural } from './structural';
import type { GenResult } from './emit';

export type { GenResult } from './emit';

/**
 * Generate Verilog for the current FSM according to the style toggle. Returns
 * both the source and a per-line owner map (state/transition id) for highlight.
 */
export function generateVerilog(fsm: FSM): GenResult {
  return fsm.config.style === 'structural'
    ? generateStructural(fsm)
    : generateBehavioral(fsm);
}
