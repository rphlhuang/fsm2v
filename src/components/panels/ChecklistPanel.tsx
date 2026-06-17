// The persistent "Four Rules" checklist. Each item turns green when the
// current diagram satisfies it, red otherwise, with detail on hover.

import { useMemo } from 'react';
import { useFSMStore } from '../../store/fsmStore';
import { validateFSM } from '../../validation/rules';

export function ChecklistPanel() {
  const states = useFSMStore((s) => s.states);
  const transitions = useFSMStore((s) => s.transitions);
  const config = useFSMStore((s) => s.config);

  const results = useMemo(
    () => validateFSM({ config, states, transitions }),
    [config, states, transitions],
  );

  return (
    <div className="absolute left-3 top-3 z-10 w-64 rounded-lg border border-slate-300 bg-white/95 p-3 shadow-md">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">FSM Rules</h2>
      <ul className="space-y-1.5">
        {results.map((r) => (
          <li key={r.id} className="flex items-start gap-2" title={r.detail}>
            <span
              className={[
                'mt-0.5 inline-block h-3 w-3 flex-shrink-0 rounded-full',
                r.pass ? 'bg-green-500' : 'bg-red-500',
              ].join(' ')}
            />
            <span className="text-xs leading-tight text-slate-700">
              {r.label}
              <span className="block text-[11px] text-slate-400">{r.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
