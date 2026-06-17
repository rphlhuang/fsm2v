// Real-time Verilog viewer. Recomputes from the store on every change.

import { useMemo, useState } from 'react';
import { useFSMStore } from '../../store/fsmStore';
import { generateVerilog } from '../../verilog';

export function CodePanel() {
  const states = useFSMStore((s) => s.states);
  const transitions = useFSMStore((s) => s.transitions);
  const config = useFSMStore((s) => s.config);
  const [copied, setCopied] = useState(false);

  const code = useMemo(
    () => generateVerilog({ config, states, transitions }),
    [config, states, transitions],
  );

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex h-full w-[460px] flex-col border-l border-slate-300 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
        <span className="text-sm font-semibold text-slate-200">
          Verilog · {config.style} · {config.encoding}
        </span>
        <button
          onClick={copy}
          className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-600"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="flex-1 overflow-auto p-3 text-[12px] leading-snug text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
