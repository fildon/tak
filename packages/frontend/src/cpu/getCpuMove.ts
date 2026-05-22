import { applyMove, opponent } from '@tak/shared';
import type { GameState, Move } from '@tak/shared';
import { getAllMoves } from './moveGen';

export function getCpuMove(state: GameState): Move {
  const moves = getAllMoves(state);

  // Take a winning move if one exists
  for (const move of moves) {
    const next = applyMove(state, move);
    if (next.result?.winner === state.currentPlayer) return move;
  }

  // Block opponent's winning move if one exists
  const opponentState = { ...state, currentPlayer: opponent(state.currentPlayer) };
  const opponentMoves = getAllMoves(opponentState);
  for (const move of opponentMoves) {
    const next = applyMove(opponentState, move);
    if (next.result?.winner === opponentState.currentPlayer) {
      // Play the same cell/stack to deny it — find our move on that square
      const block = moves.find((m) =>
        m.kind === 'place' && move.kind === 'place' && m.row === move.row && m.col === move.col,
      );
      if (block) return block;
    }
  }

  // Otherwise random
  return moves[Math.floor(Math.random() * moves.length)];
}
