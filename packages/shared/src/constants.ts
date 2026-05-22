import type { Direction } from './types';

export const PIECE_COUNTS: Record<number, { flats: number; capstones: number }> = {
  3: { flats: 10, capstones: 0 },
  4: { flats: 15, capstones: 0 },
  5: { flats: 21, capstones: 1 },
  6: { flats: 30, capstones: 1 },
  8: { flats: 50, capstones: 2 },
};

/** Row/col delta for each PTN direction symbol. */
export const DIRECTION_DELTA: Record<Direction, [number, number]> = {
  '+': [-1, 0], // North: row decreases (toward rank n)
  '-': [+1, 0], // South: row increases (toward rank 1)
  '>': [0, +1], // East:  col increases (toward file h)
  '<': [0, -1], // West:  col decreases (toward file a)
};

export const SUPPORTED_SIZES = [3, 4, 5, 6, 8] as const;
export type BoardSize = (typeof SUPPORTED_SIZES)[number];
