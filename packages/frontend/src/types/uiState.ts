import type { Direction, PieceType } from '@tak/shared';

export type UIPhase =
  | { phase: 'idle' }
  | { phase: 'placing'; pieceType: PieceType }
  | {
      phase: 'sliding';
      row: number;
      col: number;
      count: number;
      maxCount: number;
    }
  | {
      /** Direction chosen; user is editing the per-cell drop distribution. */
      phase: 'distributing';
      row: number;
      col: number;
      count: number;
      direction: Direction;
      drops: number[];
      maxSteps: number;
    }
  | { phase: 'cpu-thinking' };
