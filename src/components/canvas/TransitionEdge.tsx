// Custom directed edge. The label shows the input condition (and, in Mealy
// mode, the "/ outputs") using the chosen notation. The arc is a cubic that
// leaves along the source handle's normal and arrives along the target's, so
// facing handles give a near-straight line, same-side handles (top→top) bow
// away from the nodes, and handles pointing *away* from each other (e.g. the
// far sides of two nodes) wrap around. Parallel arcs between the same pair fan
// apart. Double-click the label to edit.

import { useEffect, useRef, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  type EdgeProps,
} from '@xyflow/react';
import type { Assignment } from '../../model/types';
import { useFSMStore } from '../../store/fsmStore';
import { parseEdgeLabel } from '../../notation/parseLabel';
import { serializeSide } from '../../notation/serializeLabel';
import { SideLabel } from '../../notation/SideLabel';

export interface TransitionEdgeData {
  guard: Assignment;
  outputs: Assignment;
  inputNames: string[];
  outputNames: string[];
  isMealy: boolean;
  /** Index of this arc among arcs between the same (unordered) node pair. */
  siblingIndex: number;
  /** Total arcs between the same (unordered) node pair. */
  siblingCount: number;
  [key: string]: unknown;
}

// Outward unit normal for each handle side.
const NORMALS: Record<Position, { x: number; y: number }> = {
  [Position.Top]: { x: 0, y: -1 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Bottom]: { x: 0, y: 1 },
  [Position.Left]: { x: -1, y: 0 },
};

export function TransitionEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    source,
    target,
    selected,
  } = props;
  const d = props.data as TransitionEdgeData;
  const isSelfLoop = source === target;

  const stroke = selected ? '#3b82f6' : '#475569';
  const index = d?.siblingIndex ?? 0;
  const count = d?.siblingCount ?? 1;

  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (isSelfLoop) {
    // Bow a loop outward along the source handle's normal, growing each extra
    // self-loop to a larger radius so they nest instead of overlap.
    const n = NORMALS[sourcePosition] ?? NORMALS[Position.Top];
    const tx = -n.y;
    const ty = n.x; // tangent (perpendicular to the normal)
    const r = 46 + index * 22;
    const spread = 16;
    const c1x = sourceX - tx * spread + n.x * r;
    const c1y = sourceY - ty * spread + n.y * r;
    const c2x = sourceX + tx * spread + n.x * r;
    const c2y = sourceY + ty * spread + n.y * r;
    edgePath = `M ${sourceX} ${sourceY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${targetX} ${targetY}`;
    labelX = sourceX + n.x * (r + 8);
    labelY = sourceY + n.y * (r + 8);
  } else {
    const n1 = NORMALS[sourcePosition] ?? { x: 0, y: 0 };
    const n2 = NORMALS[targetPosition] ?? { x: 0, y: 0 };
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const dist = Math.hypot(dx, dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;

    // How much each handle faces *away* from the other endpoint (0..1).
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const sOut = clamp01(-(n1.x * dirX + n1.y * dirY));
    const tOut = clamp01(n2.x * dirX + n2.y * dirY);

    // Control arms reach out along each handle's normal; arms grow when the
    // handle faces away (so the curve swings out and wraps around).
    const reach = Math.min(dist * 0.45, 150);
    const k1 = 30 + sOut * reach;
    const k2 = 30 + tOut * reach;
    let c1x = sourceX + n1.x * k1;
    let c1y = sourceY + n1.y * k1;
    let c2x = targetX + n2.x * k2;
    let c2y = targetY + n2.y * k2;

    // Upward-biased perpendicular: when wrapping, bulge the controls to one
    // side (preferring "up") so the curve detours around instead of through.
    let px = -dirY;
    let py = dirX;
    if (py > 0) {
      px = -px;
      py = -py;
    }
    const wrap = Math.max(sOut, tOut) * 70;
    c1x += px * wrap;
    c1y += py * wrap;
    c2x += px * wrap;
    c2y += py * wrap;

    // Fan parallel arcs apart along a direction-independent perpendicular so
    // both directions of a pair separate predictably.
    if (count > 1) {
      let qx = -dirY;
      let qy = dirX;
      if (source > target) {
        qx = -qx;
        qy = -qy;
      }
      const spread = (index - (count - 1) / 2) * 46;
      c1x += qx * spread;
      c1y += qy * spread;
      c2x += qx * spread;
      c2y += qy * spread;
    }

    edgePath = `M ${sourceX} ${sourceY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${targetX} ${targetY}`;
    // Midpoint (t=0.5) of the cubic, for the label.
    labelX = 0.125 * sourceX + 0.375 * c1x + 0.375 * c2x + 0.125 * targetX;
    labelY = 0.125 * sourceY + 0.375 * c1y + 0.375 * c2y + 0.125 * targetY;
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={selected ? 'url(#fsm-arrow-sel)' : 'url(#fsm-arrow)'}
        style={{ stroke, strokeWidth: selected ? 2.25 : 1.5 }}
      />
      <EdgeLabelRenderer>
        <EdgeLabel id={id} data={d} selected={!!selected} x={labelX} y={labelY} />
      </EdgeLabelRenderer>
    </>
  );
}

function EdgeLabel({
  id,
  data,
  selected,
  x,
  y,
}: {
  id: string;
  data: TransitionEdgeData;
  selected: boolean;
  x: number;
  y: number;
}) {
  const config = useFSMStore((s) => s.config);
  const updateTransition = useFSMStore((s) => s.updateTransition);
  const [editing, setEditing] = useState(false);

  return (
    <div
      className={[
        'absolute -translate-x-1/2 -translate-y-1/2 rounded border bg-white/90 px-1 text-xs',
        selected ? 'border-blue-500' : 'border-slate-300',
      ].join(' ')}
      style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`, pointerEvents: 'all' }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {editing ? (
        <LabelInput
          initial={seedText(data, config)}
          placeholder={config.type === 'mealy' ? 'e.g. 10 / 1' : 'e.g. 10  or  !A, B'}
          onCommit={(text) => {
            const res = parseEdgeLabel(text, config);
            if (res.ok) updateTransition(id, { guard: res.value.guard, outputs: res.value.outputs });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <Label data={data} notation={config.notation} />
      )}
    </div>
  );
}

/** Current label text in the active notation, for seeding inline editing. */
function seedText(data: TransitionEdgeData, config: { type: string; inputs: string[]; outputs: string[]; notation: 'positional' | 'named' }): string {
  const guard = serializeSide(data.guard, config.inputs, config.notation, '-');
  if (config.type === 'mealy') {
    return `${guard} / ${serializeSide(data.outputs, config.outputs, config.notation, '0')}`;
  }
  return guard;
}

function LabelInput({
  initial,
  placeholder,
  onCommit,
  onCancel,
}: {
  initial: string;
  placeholder: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(value);
        else if (e.key === 'Escape') onCancel();
        e.stopPropagation();
      }}
      className="nodrag w-28 rounded border border-blue-400 px-1 font-mono text-xs outline-none"
    />
  );
}

function Label({ data, notation }: { data: TransitionEdgeData; notation: 'positional' | 'named' }) {
  const guardEmpty = Object.keys(data.guard).length === 0;
  return (
    <span>
      {guardEmpty ? (
        <span className="text-slate-400">?</span>
      ) : (
        <SideLabel assignment={data.guard} names={data.inputNames} notation={notation} absentChar="-" />
      )}
      {data.isMealy && (
        <>
          {' / '}
          <SideLabel assignment={data.outputs} names={data.outputNames} notation={notation} absentChar="0" />
        </>
      )}
    </span>
  );
}
