# FSM → Verilog Designer

An interactive tool for an *Intro to Logic Design* course: draw a Finite State
Machine on a canvas and get clean, **heavily commented** Verilog in real time.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (Vitest)
npm run build    # type-check + production build
```

## Using the app

- **Double-click the canvas** (or **+ Add State**) to drop a state bubble.
- **Drag from one state to another** to create a transition.
- **Click** a state or transition to edit it in the **Inspector** (bottom-left).
  Mark a state as the reset state there.
- The **Four Rules** checklist (top-left) turns green when the machine is
  completely specified, uniquely specified, has a reset state, and uses pure
  Mealy/Moore notation.
- The **Verilog panel** (right) updates live.

### Toolbar toggles

| Toggle | Options |
| --- | --- |
| Machine | **Moore** (outputs in bubbles) / **Mealy** (outputs on arcs) |
| Encoding | **Min-length** (binary) / **One-hot** |
| Style | **Behavioral** (`case` blocks) / **Structural** (Xilinx `FDRE`/`FDSE` + minimized SOP) |

Switching Moore → Mealy is silent (each state's output moves onto its outgoing
arcs). Mealy → Moore warns first if a state's outgoing arcs assert conflicting
outputs (that information can't survive the collapse).

### Label notation

Transition and Moore-output labels accept the notation used on the board.
Inverted signals are typed with `!` and render with an overbar.

- **Positional** (fully specified bits): `010`, `1`, `11`
- **Named / sparse** (omitted input = don't-care): `LA`, `!F`, `AB`, `!LA, LB, !E`
- **Mealy edge** = `inputs / outputs`, e.g. `10 / 1` or `!LA, LB / X`

## How it works

- **`src/store/fsmStore.ts`** — the single source of truth (Zustand). React Flow
  nodes/edges are views derived from it.
- **`src/notation/`** — parser + overbar renderer for both label dialects.
- **`src/model/minterms.ts`** — guard → minterm expansion, shared by validation
  and minimization.
- **`src/validation/rules.ts`** — the four rules, each a pure function.
- **`src/logic/quineMcCluskey.ts`** — Quine-McCluskey + Petrick minimization for
  the structural next-state and output equations.
- **`src/verilog/`** — behavioral and structural generators (+ shared encoding
  and diagram-tracing comments).
