// Editor for the currently-selected state or transition. Label text is parsed
// live with class-notation rules; parse errors show inline and editing the
// model only happens on a successful parse.

import { useEffect, useState } from 'react';
import { useFSMStore } from '../../store/fsmStore';
import { parseEdgeLabel, parseStateOutputs } from '../../notation/parseLabel';
import { serializeSide } from '../../notation/serializeLabel';

export function InspectorPanel() {
  const selectedId = useFSMStore((s) => s.selectedId);
  const states = useFSMStore((s) => s.states);
  const transitions = useFSMStore((s) => s.transitions);

  const state = states.find((s) => s.id === selectedId);
  const transition = transitions.find((t) => t.id === selectedId);

  return (
    <div className="absolute bottom-3 left-3 z-10 w-72 rounded-lg border border-slate-300 bg-white/95 p-3 shadow-md">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">Inspector</h2>
      {state ? (
        <StateEditor key={state.id} stateId={state.id} />
      ) : transition ? (
        <TransitionEditor key={transition.id} transitionId={transition.id} />
      ) : (
        <p className="text-xs text-slate-400">
          Select a state or transition to edit it. Drag between states to add a transition.
        </p>
      )}
    </div>
  );
}

function StateEditor({ stateId }: { stateId: string }) {
  const config = useFSMStore((s) => s.config);
  const state = useFSMStore((s) => s.states.find((x) => x.id === stateId))!;
  const updateState = useFSMStore((s) => s.updateState);
  const setStateOutputs = useFSMStore((s) => s.setStateOutputs);
  const setResetState = useFSMStore((s) => s.setResetState);
  const removeState = useFSMStore((s) => s.removeState);

  const isReset = config.resetStateId === stateId;
  const [outText, setOutText] = useState(() =>
    serializeSide(state.outputs, config.outputs, config.notation, '0'),
  );
  const [error, setError] = useState<string | null>(null);

  // Re-seed the field only when the selection, signal set, or display dialect
  // changes — NOT on every keystroke, so the user's literal text is preserved.
  useEffect(() => {
    setOutText(serializeSide(state.outputs, config.outputs, config.notation, '0'));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateId, config.outputs, config.notation]);

  const onOut = (text: string) => {
    setOutText(text);
    const res = parseStateOutputs(text, config);
    if (res.ok) {
      setError(null);
      setStateOutputs(stateId, res.value);
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs text-slate-500">
        Name
        <input
          value={state.label}
          onChange={(e) => updateState(stateId, { label: e.target.value })}
          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </label>

      {config.type === 'moore' && (
        <label className="block text-xs text-slate-500">
          Outputs ({config.outputs.join(', ') || 'none defined'})
          <input
            value={outText}
            onChange={(e) => onOut(e.target.value)}
            placeholder="e.g. 10 or X, !Y"
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm"
          />
        </label>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => setResetState(isReset ? null : stateId)}
          className={[
            'flex-1 rounded px-2 py-1 text-xs',
            isReset ? 'bg-violet-600 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-100',
          ].join(' ')}
        >
          {isReset ? 'Reset state ✓' : 'Set as reset'}
        </button>
        <button
          onClick={() => removeState(stateId)}
          className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function TransitionEditor({ transitionId }: { transitionId: string }) {
  const config = useFSMStore((s) => s.config);
  const transition = useFSMStore((s) => s.transitions.find((x) => x.id === transitionId))!;
  const states = useFSMStore((s) => s.states);
  const updateTransition = useFSMStore((s) => s.updateTransition);
  const reverseTransition = useFSMStore((s) => s.reverseTransition);
  const removeTransition = useFSMStore((s) => s.removeTransition);

  const srcLabel = states.find((s) => s.id === transition.source)?.label ?? '?';
  const dstLabel = states.find((s) => s.id === transition.target)?.label ?? '?';

  const initial = () => {
    const guard = serializeSide(transition.guard, config.inputs, config.notation, '-');
    if (config.type === 'mealy') {
      return `${guard} / ${serializeSide(transition.outputs, config.outputs, config.notation, '0')}`;
    }
    return guard;
  };

  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  // Re-seed only on selection / signal-set / dialect changes (see StateEditor).
  useEffect(() => {
    setText(initial());
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitionId, config.type, config.inputs, config.outputs, config.notation]);

  const onChange = (value: string) => {
    setText(value);
    const res = parseEdgeLabel(value, config);
    if (res.ok) {
      setError(null);
      updateTransition(transitionId, { guard: res.value.guard, outputs: res.value.outputs });
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Transition <span className="font-semibold text-slate-700">{srcLabel} → {dstLabel}</span>
      </p>
      <label className="block text-xs text-slate-500">
        {config.type === 'mealy' ? 'inputs / outputs' : 'inputs'} (use ! for inverted)
        <input
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={config.type === 'mealy' ? 'e.g. 10 / 1  or  !A, B / X' : 'e.g. 10  or  !A, B'}
          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm"
        />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => reverseTransition(transitionId)}
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
          title={`Reverse direction (${dstLabel} → ${srcLabel})`}
        >
          ⇄ Reverse direction
        </button>
        <button
          onClick={() => removeTransition(transitionId)}
          className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
