// Top toolbar: machine type, encoding, code style, and input/output names.

import { useEffect, useState } from 'react';
import { useFSMStore } from '../../store/fsmStore';

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; text: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <div className="flex overflow-hidden rounded-md border border-slate-300">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={[
              'px-3 py-1 text-xs',
              value === o.value ? 'bg-violet-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100',
            ].join(' ')}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function NameEditor({
  label,
  names,
  onChange,
}: {
  label: string;
  names: string[];
  onChange: (names: string[]) => void;
}) {
  // Keep the raw text locally so commas/spaces can be typed freely; commit the
  // parsed list to the store on each change. Re-seed only when names change
  // from elsewhere (e.g. the Signals table), not on our own keystrokes.
  const parse = (value: string) => {
    const seen = new Set<string>();
    return value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !seen.has(s) && seen.add(s));
  };

  const [text, setText] = useState(names.join(', '));
  // Re-seed only when the store list differs from what our text already says —
  // i.e. an *external* change (the Signals table) — so our own keystrokes
  // (including trailing commas/spaces) are never clobbered.
  useEffect(() => {
    if (parse(text).join(' ') !== names.join(' ')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(names.join(', '));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names]);

  const onInput = (value: string) => {
    setText(value);
    onChange(parse(value));
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <input
        value={text}
        onChange={(e) => onInput(e.target.value)}
        className="w-32 rounded-md border border-slate-300 px-2 py-1 font-mono text-xs"
        placeholder="comma-separated, e.g. A, B"
      />
    </div>
  );
}

export function Toolbar() {
  const config = useFSMStore((s) => s.config);
  const requestType = useFSMStore((s) => s.requestType);
  const setEncoding = useFSMStore((s) => s.setEncoding);
  const setStyle = useFSMStore((s) => s.setStyle);
  const setNotation = useFSMStore((s) => s.setNotation);
  const setInputs = useFSMStore((s) => s.setInputs);
  const setOutputs = useFSMStore((s) => s.setOutputs);
  const addState = useFSMStore((s) => s.addState);
  const openSetup = useFSMStore((s) => s.openSetup);

  return (
    <div className="flex items-end gap-5 border-b border-slate-300 bg-white px-4 py-2">
      <div className="mr-2 flex items-center">
        <span className="text-base font-bold lowercase tracking-tight text-slate-900">fsm2v</span>
      </div>

      <Segmented
        label="Machine"
        value={config.type}
        options={[
          { value: 'moore', text: 'Moore' },
          { value: 'mealy', text: 'Mealy' },
        ]}
        onChange={requestType}
      />
      <Segmented
        label="Encoding"
        value={config.encoding}
        options={[
          { value: 'binary', text: 'Min-length' },
          { value: 'one-hot', text: 'One-hot' },
        ]}
        onChange={setEncoding}
      />
      <Segmented
        label="Style"
        value={config.style}
        options={[
          { value: 'behavioral', text: 'Behavioral' },
          { value: 'structural', text: 'Structural' },
        ]}
        onChange={setStyle}
      />

      <Segmented
        label="Display"
        value={config.notation}
        options={[
          { value: 'positional', text: '0/1' },
          { value: 'named', text: 'A/F' },
        ]}
        onChange={setNotation}
      />

      <NameEditor label="Inputs" names={config.inputs} onChange={setInputs} />
      <NameEditor label="Outputs" names={config.outputs} onChange={setOutputs} />

      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">&nbsp;</span>
        <button
          onClick={() => openSetup('table')}
          className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
          title="Edit inputs & outputs in a table"
        >
          Signals…
        </button>
      </div>

      <button
        onClick={() => addState({ x: 120 + Math.random() * 200, y: 80 + Math.random() * 160 })}
        className="ml-auto rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
      >
        + Add State
      </button>
    </div>
  );
}
