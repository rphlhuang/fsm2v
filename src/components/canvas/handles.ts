// Connection handles for a state bubble: the four sides plus the four diagonal
// corners (8 attachment points). Each handle has an id (stored on the
// transition as sourceHandle/targetHandle), a React Flow `position` (used for
// the live connection-line direction) and an absolute `style` placing it on the
// circular bubble. Edge routing reads `HANDLE_NORMALS` to leave/arrive along the
// handle's outward direction, so diagonal handles bow correctly.

import { Position } from '@xyflow/react';
import type { CSSProperties } from 'react';

export interface HandleSide {
  id: string;
  position: Position;
  style: CSSProperties;
}

// A corner handle's centre sits on the circular bubble at 45°, i.e. 50% ± r·cos45
// from each edge (50% ± 35.36%). We center the dot on that point with a
// translate(-50%,-50%), overriding React Flow's per-side edge placement.
const NEAR = '14.64%'; // 50% - 35.36%
const FAR = '85.36%'; // 50% + 35.36%
const corner = (top: string, left: string) => ({
  top,
  left,
  right: 'auto' as const,
  bottom: 'auto' as const,
  transform: 'translate(-50%, -50%)',
});

export const HANDLE_SIDES: HandleSide[] = [
  { id: 'top', position: Position.Top, style: {} },
  { id: 'right', position: Position.Right, style: {} },
  { id: 'bottom', position: Position.Bottom, style: {} },
  { id: 'left', position: Position.Left, style: {} },
  { id: 'top-right', position: Position.Top, style: corner(NEAR, FAR) },
  { id: 'bottom-right', position: Position.Bottom, style: corner(FAR, FAR) },
  { id: 'bottom-left', position: Position.Bottom, style: corner(FAR, NEAR) },
  { id: 'top-left', position: Position.Top, style: corner(NEAR, NEAR) },
];

const D = Math.SQRT1_2; // 0.707 — diagonal unit component

/** Outward unit normal per handle id, for edge routing. */
export const HANDLE_NORMALS: Record<string, { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  'top-right': { x: D, y: -D },
  'bottom-right': { x: D, y: D },
  'bottom-left': { x: -D, y: D },
  'top-left': { x: -D, y: -D },
};
