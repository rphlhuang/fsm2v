# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An interactive web app for an *Intro to Logic Design* course: draw a Finite State
Machine on a canvas and get clean, heavily-commented Verilog generated live.
React 19 + TypeScript + Vite, React Flow (`@xyflow/react`) for the canvas, Zustand
for state, Tailwind v4. No backend.

## Commands

```bash
npm run dev          # Vite dev server at http://localhost:5173
npm run build        # tsc -b (type-check) + vite build
npm run lint         # eslint .
npm test             # vitest run (single pass)
npm run test:watch   # vitest watch mode
npx vitest run src/logic/quineMcCluskey.test.ts   # run one test file
npx vitest run -t "name of test"                  # run tests matching a name
```

There is no separate type-check script; `npm run build` runs `tsc -b` first.

## Architecture

The whole app revolves around **one canonical FSM model**, and everything else is
derived from it. Read these in order to understand the data flow:

1. **`src/model/types.ts`** — the model: `FSM = { config, states[], transitions[] }`.
   The central abstraction is `Assignment` (`Record<string, Bit>`): a *partial*
   assignment over named signals where an absent key means "don't-care". This one
   type backs both label dialects (positional `010` and named/sparse `LA, !E`),
   transition guards, and outputs.

2. **`src/store/fsmStore.ts`** — the single source of truth (Zustand). React Flow
   nodes/edges are **views** that hold only ids + positions and point back into
   this store. Validation, codegen, and minimization all read the model via
   `selectFSM`. Mealy/Moore conversion goes through `requestType`: Moore→Mealy is
   always lossless and applies immediately; Mealy→Moore may lose info (conflicting
   arc outputs collapsing into one state) and is staged in `pendingConversion`
   behind a confirmation dialog (`confirmConversion`/`cancelConversion`).

3. **`src/model/minterms.ts`** — `guardToMinterms` expands a partial `Assignment`
   into the full input combinations it covers (fanning out don't-cares). This is
   the **shared primitive** under both validation and minimization. Bit convention:
   `inputs[0]` is the most-significant bit (matches positional `"010"`).

4. **`src/validation/rules.ts`** — the "Four Rules", each a pure function of the
   FSM: completely specified, uniquely specified, has a reset state, pure
   Mealy/Moore notation. Drives the checklist panel.

5. **`src/logic/quineMcCluskey.ts`** — Quine-McCluskey + Petrick minimization,
   used only by the **structural** Verilog generator for next-state/output SOP.

6. **`src/verilog/`** — `index.ts` dispatches on `config.style` to
   `behavioral.ts` (`case` blocks) or `structural.ts` (Xilinx `FDRE`/`FDSE` +
   minimized SOP). Shared helpers: `encoding.ts` (state-bit encoding for
   one-hot/binary) and `comments.ts` (diagram-tracing comments).

7. **`src/notation/`** — `parseLabel.ts` / `serializeLabel.ts` convert between the
   typed label text and `Assignment`; `SideLabel.tsx` renders inverted signals
   with an overbar.

8. **`src/components/`** — `canvas/` (React Flow nodes/edges/canvas), `panels/`
   (Toolbar, ChecklistPanel, InspectorPanel, CodePanel), `dialogs/`
   (LossyConvertDialog).

## Conventions

- **Logic is separated from UI.** `model/`, `logic/`, `validation/`, `verilog/`,
  and `notation/` are pure, framework-free, and unit-tested (`*.test.ts`
  colocated). Keep new domain logic there, not in components.
- When changing the FSM shape or guard/output semantics, the minterm/validation/
  codegen layers all consume the same `Assignment` convention — update
  `minterms.ts` and re-check its test, since both validation and QM depend on it.
- Three orthogonal toggles drive codegen, all in `config`: `type`
  (mealy/moore), `encoding` (one-hot/binary), `style` (behavioral/structural).
