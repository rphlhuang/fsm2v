// Custom circular state "bubble". In Moore mode the bubble is split: the
// state name on top, the asserted outputs on the bottom. The reset state gets
// a lightning-bolt arrow pointing into it (the convention used in class); that
// bolt can be dragged onto another state to move the reset there. Double-click
// the name to rename it inline.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, type NodeProps } from '@xyflow/react';
import type { Assignment } from '../../model/types';
import { useFSMStore } from '../../store/fsmStore';
import { SideLabel } from '../../notation/SideLabel';
import { parseStateOutputs } from '../../notation/parseLabel';
import { serializeSide } from '../../notation/serializeLabel';
import { HANDLE_SIDES } from './handles';

export interface StateNodeData {
  label: string;
  outputs: Assignment;
  outputNames: string[];
  isMoore: boolean;
  isReset: boolean;
  [key: string]: unknown;
}

// The reset bolt: short lead, two triangles, then a longer straight run into the
// arrowhead. Shared between the in-node marker and the drag ghost.
const BOLT_PATH = 'M0 9 L7 9 L13 4 L19 14 L25 9 L44 9';
const BOLT_W = 44;
const BOLT_H = 18;

export function StateNode({ id, data, selected }: NodeProps) {
  const d = data as StateNodeData;
  const hasOutputs = d.outputNames.length > 0;

  const config = useFSMStore((s) => s.config);
  const notation = config.notation;
  const updateState = useFSMStore((s) => s.updateState);
  const setStateOutputs = useFSMStore((s) => s.setStateOutputs);
  const setResetState = useFSMStore((s) => s.setResetState);
  const select = useFSMStore((s) => s.select);
  const resetSelected = useFSMStore((s) => s.selectedId === 'reset');

  // Which region is being edited inline: the name (top) or the outputs (bottom).
  const [editing, setEditing] = useState<'name' | 'outputs' | null>(null);
  // While dragging the reset bolt, a ghost copy follows the cursor (see below).
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number } | null>(null);

  const startEditing = (field: 'name' | 'outputs') => (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(field);
  };

  // Click the reset bolt to select it (Backspace then clears the reset); drag
  // it onto another state to move the reset designation there. During a drag a
  // ghost bolt tracks the cursor so the gesture reads clearly.
  const onBoltPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4) moved = true;
      if (moved) setDragGhost({ x: ev.clientX, y: ev.clientY });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragGhost(null);
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
          width={BOLT_W}
          height={BOLT_H}
          viewBox={`0 0 ${BOLT_W} ${BOLT_H}`}
          style={{ overflow: 'visible' }}
        >
          {/* Fat invisible hit area so the thin bolt is easy to grab/click. */}
          <path d={BOLT_PATH} fill="none" stroke="transparent" strokeWidth="14" />
          <path
            d={BOLT_PATH}
            fill="none"
            stroke={resetSelected ? '#3b82f6' : '#475569'}
            strokeWidth={resetSelected ? 2.25 : 1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
            markerEnd={resetSelected ? 'url(#fsm-arrow-sel)' : 'url(#fsm-arrow)'}
          />
        </svg>
      )}

      {/* Ghost bolt that follows the cursor while the reset marker is dragged. */}
      {dragGhost &&
        createPortal(
          <svg
            className="pointer-events-none fixed z-50"
            style={{ left: dragGhost.x, top: dragGhost.y, transform: 'translate(-100%, -50%)', overflow: 'visible' }}
            width={BOLT_W}
            height={BOLT_H}
            viewBox={`0 0 ${BOLT_W} ${BOLT_H}`}
          >
            <path
              d={BOLT_PATH}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
              markerEnd="url(#fsm-arrow-sel)"
            />
          </svg>,
          document.body,
        )}

      {/* Connection handles: 4 sides + 4 corners (Loose mode lets them be targets too). */}
      {HANDLE_SIDES.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type="source"
          position={h.position}
          style={h.style}
          className="!h-2 !w-2 !border !border-white !bg-slate-500"
        />
      ))}

      {d.isMoore && hasOutputs ? (
        <>
          {/* Top half: state name. Double-click to rename inline, right here. */}
          <div
            onDoubleClick={startEditing('name')}
            className="flex h-1/2 w-full items-center justify-center border-b border-slate-300 text-sm font-semibold leading-none"
          >
            {editing === 'name' ? (
              <NameInput
                initial={d.label}
                onCommit={(name) => {
                  if (name.trim()) updateState(id, { label: name.trim() });
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              d.label
            )}
          </div>
          {/* Bottom half: asserted outputs. Double-click to edit inline. */}
          <div
            onDoubleClick={startEditing('outputs')}
            className="flex h-1/2 w-full items-center justify-center text-xs leading-none text-slate-600"
          >
            {editing === 'outputs' ? (
              <OutputInput
                initial={serializeSide(d.outputs, d.outputNames, notation, '0')}
                placeholder={notation === 'positional' ? '10' : 'Z, !Y'}
                onCommit={(text) => {
                  const res = parseStateOutputs(text, config);
                  if (res.ok) setStateOutputs(id, res.value);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <SideLabel assignment={d.outputs} names={d.outputNames} notation={notation} absentChar="0" />
            )}
          </div>
        </>
      ) : (
        <div onDoubleClick={startEditing('name')} className="text-sm font-semibold">
          {editing === 'name' ? (
            <NameInput
              initial={d.label}
              onCommit={(name) => {
                if (name.trim()) updateState(id, { label: name.trim() });
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            d.label
          )}
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

/** Inline text box for editing a Moore state's asserted outputs. */
function OutputInput({
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
      onDoubleClick={(e) => e.stopPropagation()}
      // Size to content (ch is exact in a mono font) so the box stays inside the
      // bubble's bottom half and centered, matching the arc-label editor.
      style={{ width: `${Math.max(value.length, placeholder.length, 2) + 1}ch` }}
      className="nodrag rounded border border-blue-400 px-1 text-center font-mono text-xs outline-none"
    />
  );
}
