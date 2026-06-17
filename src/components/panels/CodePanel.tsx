// Real-time Verilog viewer. Recomputes from the store on every change.
// The panel can collapse off to the right (leaving a reopen tab) and, when open,
// be resized by dragging its left edge.

import { useMemo, useState } from 'react';
import { useFSMStore } from '../../store/fsmStore';
import { generateVerilog } from '../../verilog';

const MIN_WIDTH = 320;
const MAX_WIDTH = 820;
const DEFAULT_WIDTH = 460;

export function CodePanel() {
  const states = useFSMStore((s) => s.states);
  const transitions = useFSMStore((s) => s.transitions);
  const config = useFSMStore((s) => s.config);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  const code = useMemo(
    () => generateVerilog({ config, states, transitions }),
    [config, states, transitions],
  );

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  // Drag the left edge: panel width tracks the distance from the cursor to the
  // right edge of the viewport, clamped to a sane range.
  const onResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const next = window.innerWidth - ev.clientX;
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, next)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  if (collapsed) {
    return (
      <div className="flex h-full flex-shrink-0 flex-col border-l border-slate-300 bg-slate-900">
        <button
          onClick={() => setCollapsed(false)}
          className="flex h-full w-7 items-center justify-center text-xs font-semibold text-slate-300 hover:bg-slate-800"
          title="Show Verilog panel"
        >
          <span style={{ writingMode: 'vertical-rl' }} className="rotate-180">
            ‹ Code
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full flex-shrink-0 flex-col border-l border-slate-300 bg-slate-900"
      style={{ width }}
    >
      {/* Left-edge resize grip. */}
      <div
        onPointerDown={onResizeStart}
        className="absolute left-0 top-0 z-10 h-full w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-blue-500/40"
      />
      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
        <span className="text-sm font-semibold text-slate-200">
          Verilog · {config.style} · {config.encoding}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-600"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-600"
            title="Hide Verilog panel"
          >
            ›
          </button>
        </div>
      </div>
      <pre className="flex-1 overflow-auto p-3 text-[12px] leading-snug text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
