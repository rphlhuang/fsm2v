// Custom circular state "bubble". In Moore mode the bubble is split: the
// state name on top, the asserted outputs on the bottom. The reset state gets
// a lightning-bolt arrow pointing into it (the convention used in class); that
// bolt can be dragged onto another state to move the reset there. Double-click
// the name to rename it inline.

import { useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Assignment } from '../../model/types';
import { useFSMStore } from '../../store/fsmStore';
import { SideLabel } from '../../notation/SideLabel';

export interface StateNodeData {
  label: string;
  outputs: Assignment;
  outputNames: string[];
  isMoore: boolean;
  isReset: boolean;
  [key: string]: unknown;
}

const HANDLE_SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
];

export function StateNode({ id, data, selected }: NodeProps) {
  const d = data as StateNodeData;
  const hasOutputs = d.outputNames.length > 0;

  const notation = useFSMStore((s) => s.config.notation);
  const updateState = useFSMStore((s) => s.updateState);
  const setResetState = useFSMStore((s) => s.setResetState);
  const select = useFSMStore((s) => s.select);
  const resetSelected = useFSMStore((s) => s.selectedId === 'reset');

  const [editing, setEditing] = useState(false);

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };

  // Click the reset bolt to select it (Backspace then clears the reset); drag
  // it onto another state to move the reset designation there.
  const onBoltPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4) moved = true;
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!moved) {
        select('reset');
        return;
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const nodeEl = el?.closest('.react-flow__node') as HTMLElement | null;
      const targetId = nodeEl?.getAttribute('data-id');
      if (targetId) setResetState(targetId);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      className={[
        'relative flex h-20 w-20 select-none flex-col items-center justify-center rounded-full',
        'bg-white text-center shadow-sm transition-shadow',
        selected
          ? 'border-2 border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.35)]'
          : 'border-2 border-slate-700',
      ].join(' ')}
    >
      {/* Reset marker: a lightning bolt — short straight lead, two triangles
          (one up, one down), short straight, then the arrowhead — pointing into
          the node from the left. Click to select, drag to re-assign. */}
      {d.isReset && (
        <svg
          onPointerDown={onBoltPointerDown}
          onClick={(e) => e.stopPropagation()}
          className="nodrag absolute right-full top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
          width="31"
          height="18"
          viewBox="0 0 31 18"
          style={{ overflow: 'visible' }}
        >
          {/* Fat invisible hit area so the thin bolt is easy to grab/click. */}
          <path d="M0 9 L7 9 L13 4 L19 14 L25 9 L31 9" fill="none" stroke="transparent" strokeWidth="14" />
          <path
            d="M0 9 L7 9 L13 4 L19 14 L25 9 L31 9"
            fill="none"
            stroke={resetSelected ? '#3b82f6' : '#475569'}
            strokeWidth={resetSelected ? 2.25 : 1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
            markerEnd={resetSelected ? 'url(#fsm-arrow-sel)' : 'url(#fsm-arrow)'}
          />
        </svg>
      )}

      {/* Connection handles on all four sides (Loose mode lets them be targets too). */}
      {HANDLE_SIDES.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type="source"
          position={h.position}
          className="!h-2 !w-2 !border !border-white !bg-slate-500"
        />
      ))}

      {editing ? (
        <NameInput
          initial={d.label}
          onCommit={(name) => {
            if (name.trim()) updateState(id, { label: name.trim() });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : d.isMoore && hasOutputs ? (
        <>
          <div
            onDoubleClick={startEditing}
            className="flex h-1/2 w-full items-center justify-center border-b border-slate-300 text-sm font-semibold leading-none"
          >
            {d.label}
          </div>
          <div className="flex h-1/2 w-full items-center justify-center text-xs leading-none text-slate-600">
            <SideLabel assignment={d.outputs} names={d.outputNames} notation={notation} absentChar="0" />
          </div>
        </>
      ) : (
        <div onDoubleClick={startEditing} className="text-sm font-semibold">
          {d.label}
        </div>
      )}
    </div>
  );
}

/** Inline text box for renaming a state. */
function NameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (name: string) => void;
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
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(value);
        else if (e.key === 'Escape') onCancel();
        e.stopPropagation();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      className="nodrag w-14 rounded border border-blue-400 px-1 text-center text-sm font-semibold outline-none"
    />
  );
}
