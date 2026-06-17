import type { FSM } from '../model/types';
import { generateBehavioral } from './behavioral';
import { generateStructural } from './structural';

/** Generate Verilog for the current FSM according to the style toggle. */
export function generateVerilog(fsm: FSM): string {
  return fsm.config.style === 'structural'
    ? generateStructural(fsm)
    : generateBehavioral(fsm);
}
