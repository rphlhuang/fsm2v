// Warning shown before a *lossy* Mealy -> Moore conversion. The affected
// states have conflicting incoming outputs that cannot survive the collapse,
// so confirming zeroes them out (per the agreed behavior).

import { useFSMStore } from '../../store/fsmStore';

export function LossyConvertDialog() {
  const pending = useFSMStore((s) => s.pendingConversion);
  const confirm = useFSMStore((s) => s.confirmConversion);
  const cancel = useFSMStore((s) => s.cancelConversion);

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[420px] rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-slate-800">Lossy conversion to Moore</h2>
        <p className="mt-2 text-sm text-slate-600">
          In a Moore machine each state emits a single output vector. These states are entered by
          transitions that assert <em>different</em> outputs, so the output cannot be preserved:
        </p>
        <ul className="mt-2 list-inside list-disc text-sm font-medium text-red-600">
          {pending.lossyStateLabels.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-slate-600">
          Continuing will set the outputs of these states to <code>0</code>. You can edit them
          afterwards.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={cancel}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            className="rounded bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-500"
          >
            Convert anyway
          </button>
        </div>
      </div>
    </div>
  );
}
