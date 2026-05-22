import type { PieceType } from '@tak/shared';

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
  | { phase: 'cpu-thinking' };
