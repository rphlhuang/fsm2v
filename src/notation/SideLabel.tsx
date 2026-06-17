// Renders an Assignment using class notation, with real overbars on inverted
// signals. Used by both transition edges and Moore state bubbles.

import type { Assignment, Notation } from '../model/types';
import { sideTokens } from './serializeLabel';

export function Overbar({ children }: { children: React.ReactNode }) {
  return <span className="overbar">{children}</span>;
}

export function SideLabel({
  assignment,
  names,
  notation = 'named',
  absentChar = '-',
}: {
  assignment: Assignment;
  names: string[];
  notation?: Notation;
  absentChar?: string;
}) {
  const { tokens, separator } = sideTokens(assignment, names, notation, absentChar);
  if (tokens.length === 0) return null;
  return (
    <span>
      {tokens.map((tok, i) => (
        <span key={i}>
          {i > 0 && separator}
          {tok.inverted ? <Overbar>{tok.name}</Overbar> : tok.name}
        </span>
      ))}
    </span>
  );
}
