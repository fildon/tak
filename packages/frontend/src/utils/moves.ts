import { DIRECTION_DELTA } from '@tak/shared';
import type { Board, Direction } from '@tak/shared';

/**
 * Computes the drops array for a slide move using the "1-per-intermediate,
 * remainder-on-last" distribution strategy.
 * Returns [] if the very first step is off-board or blocked by a capstone.
 */
export function computeDrops(
  board: Board,
  size: number,
  row: number,
  col: number,
  direction: Direction,
  count: number,
): number[] {
  const [dr, dc] = DIRECTION_DELTA[direction];
  let r = row + dr;
  let c = col + dc;
  let remaining = count;
  const drops: number[] = [];

  while (remaining > 0) {
    if (r < 0 || r >= size || c < 0 || c >= size) break;

    const top = board[r][c].at(-1);
    if (top?.type === 'capstone') break;

    const nr = r + dr;
    const nc = c + dc;
    const hasNext =
      nr >= 0 &&
      nr < size &&
      nc >= 0 &&
      nc < size &&
      board[nr][nc].at(-1)?.type !== 'capstone';

    // Must stop here: hit a wall, nowhere to continue, or only 1 piece left
    const mustStop = top?.type === 'wall' || !hasNext || remaining === 1;

    drops.push(mustStop ? remaining : 1);
    if (mustStop) break;

    remaining -= 1;
    r += dr;
    c += dc;
  }

  return drops;
}
