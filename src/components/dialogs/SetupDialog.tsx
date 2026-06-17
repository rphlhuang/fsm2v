// First-load chooser + the two-column I/O signal editor. Opened automatically
// on load (the "choose" view) and reachable any time from the toolbar's
// "Signals" button (the "table" view).

import { useState } from 'react';
import { useFSMStore } from '../../store/fsmStore';

export function SetupDialog() {
  const open = useFSMStore((s) => s.setupOpen);
  const view = useFSMStore((s) => s.setupView);
  const openSetup = useFSMStore((s) => s.openSetup);
  const closeSetup = useFSMStore((s) => s.closeSetup);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {view === 'choose' ? (
        <ChooseView onPickTable={() => openSetup('table')} onPickBlank={closeSetup} />
      ) : (
        <TableView onDone={closeSetup} />
      )}
    </div>
  );
}

function ChooseView({
  onPickTable,
  onPickBlank,
}: {
  onPickTable: () => void;
  onPickBlank: () => void;
}) {
  return (
    <div className="w-[560px] max-w-full rounded-xl bg-white p-6 shadow-2xl">
      <h2 className="text-lg font-bold text-slate-800">fsm2v</h2>
      <p className="mt-1 text-sm text-slate-500">How do you want to start?</p>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <button
          onClick={onPickTable}
          className="group flex flex-col rounded-lg border border-slate-300 p-4 text-left transition-colors hover:border-violet-500 hover:bg-violet-50"
        >
          <span className="text-sm font-semibold text-slate-800">Define inputs &amp; outputs</span>
          <span className="mt-1 text-xs leading-snug text-slate-500">
            Name your signals first in a table. Best when the machine has several
            I/O.
          </span>
        </button>

        <button
          onClick={onPickBlank}
          className="group flex flex-col rounded-lg border border-slate-300 p-4 text-left transition-colors hover:border-violet-500 hover:bg-violet-50"
        >
          <span className="text-sm font-semibold text-slate-800">Start sketching</span>
          <span className="mt-1 text-xs leading-snug text-slate-500">
            Jump straight to the canvas with one input and one output. Edit
            signals any time.
          </span>
        </button>
      </div>
    </div>
  );
}

function TableView({ onDone }: { onDone: () => void }) {
  const config = useFSMStore((s) => s.config);
  const setInputs = useFSMStore((s) => s.setInputs);
  const setOutputs = useFSMStore((s) => s.setOutputs);

  // Local, editable rows (may include blanks while typing). Committed to the
  // store as the trimmed, de-duplicated, non-empty list on every change.
  const [ins, setIns] = useState<string[]>(() =>
    config.inputs.length ? config.inputs : [''],
  );
  const [outs, setOuts] = useState<string[]>(() =>
    config.outputs.length ? config.outputs : [''],
  );

  const commit = (rows: string[], setStore: (n: string[]) => void) => {
    const seen = new Set<string>();
    const clean = rows
      .map((r) => r.trim())
      .filter((r) => r && !seen.has(r) && seen.add(r));
    setStore(clean);
  };

  return (
    <div className="flex max-h-full w-[560px] max-w-full flex-col rounded-xl bg-white p-6 shadow-2xl">
      <h2 className="text-lg font-bold text-slate-800">Signals</h2>
      <p className="mt-1 text-sm text-slate-500">
        Each name becomes a 1-bit port. Order sets the positional bit order.
      </p>

      <div className="mt-4 grid min-h-0 grid-cols-2 gap-5 overflow-auto">
        <SignalColumn
          title="Inputs"
          rows={ins}
          onChange={(rows) => {
            setIns(rows);
            commit(rows, setInputs);
          }}
        />
        <SignalColumn
          title="Outputs"
          rows={outs}
          onChange={(rows) => {
            setOuts(rows);
            commit(rows, setOutputs);
          }}
        />
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={onDone}
          className="rounded bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function SignalColumn({
  title,
  rows,
  onChange,
}: {
  title: string;
  rows: string[];
  onChange: (rows: string[]) => void;
}) {
  const setRow = (i: number, value: string) =>
    onChange(rows.map((r, j) => (j === i ? value : r)));
  const removeRow = (i: number) => onChange(rows.filter((_, j) => j !== i) || []);
  const addRow = () => onChange([...rows, '']);

  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </div>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              autoFocus={i === rows.length - 1 && row === ''}
              value={row}
              onChange={(e) => setRow(i, e.target.value)}
              placeholder={title === 'Inputs' ? 'e.g. A' : 'e.g. Z'}
              className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm"
            />
            <button
              onClick={() => removeRow(i)}
              aria-label="Remove"
              className="rounded px-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={addRow}
        className="mt-2 w-full rounded border border-dashed border-slate-300 py-1 text-xs text-slate-500 hover:border-violet-400 hover:text-violet-600"
      >
        + Add {title === 'Inputs' ? 'input' : 'output'}
      </button>
    </div>
  );
}
