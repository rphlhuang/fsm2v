// A tiny line accumulator that records, per line, which diagram element (state
// or transition id) the line was generated for. The code panel uses this map to
// light up the lines that belong to the currently selected state/arc.

export interface GenResult {
  /** The full Verilog source. */
  code: string;
  /** Owning element id (state or transition id) for each line, or null. */
  owners: (string | null)[];
}

export interface Emitter {
  /** Append a line, optionally tagging it with the id it traces back to. */
  push(line: string, owner?: string | null): void;
  result(): GenResult;
}

export function makeEmitter(): Emitter {
  const lines: string[] = [];
  const owners: (string | null)[] = [];
  return {
    push(line, owner = null) {
      // A pushed chunk may contain embedded newlines (banners, the port list).
      // Split it so `owners` stays exactly 1:1 with the rendered code lines.
      for (const l of line.split('\n')) {
        lines.push(l);
        owners.push(owner);
      }
    },
    result() {
      return { code: lines.join('\n'), owners };
    },
  };
}
