import type { Move } from '@tak/shared';

/** Converts (row, col) to PTN square notation, e.g. row=4,col=0,size=5 → "a1". */
export function toSquare(size: number, row: number, col: number): string {
  const file = String.fromCharCode('a'.charCodeAt(0) + col);
  const rank = size - row;
  return `${file}${rank}`;
}

/** Formats a Move as a PTN string, e.g. "Sa3", "2b3>11". */
export function moveToPtn(move: Move, size: number): string {
  const square = toSquare(size, move.row, move.col);

  if (move.kind === 'place') {
    if (move.pieceType === 'wall') return `S${square}`;
    if (move.pieceType === 'capstone') return `C${square}`;
    return square;
  }

  // Slide
  const total = move.drops.reduce((a, b) => a + b, 0);
  const countStr = total === 1 ? '' : String(total);
  // Omit drop counts when there's only one destination square
  const dropsStr = move.drops.length === 1 ? '' : move.drops.join('');
  return `${countStr}${square}${move.direction}${dropsStr}`;
}
