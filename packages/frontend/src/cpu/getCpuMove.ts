import { applyMove } from '@tak/shared';
import type { GameState, Move } from '@tak/shared';
import { getAllMoves } from './moveGen';

export function getCpuMove(state: GameState): Move {
  const moves = getAllMoves(state);

  // Take a winning move if one exists
  for (const move of moves) {
    const next = applyMove(state, move);
    if (next.result?.winner === state.currentPlayer) return move;
  }

  // Otherwise random
  return moves[Math.floor(Math.random() * moves.length)];
}
