import { validateMove } from '@tak/shared';
import type { GameState, Move, PieceType } from '@tak/shared';
import { computeDrops } from '../utils/moves';

const DIRECTIONS = ['+', '-', '<', '>'] as const;
const PIECE_TYPES: PieceType[] = ['flat', 'wall', 'capstone'];

export function getAllMoves(state: GameState): Move[] {
  const { board, size, currentPlayer, players, turnNumber } = state;
  const moves: Move[] = [];

  // On swap turns only flat placements are legal (opponent's flat)
  const pieceTypes: PieceType[] =
    turnNumber <= 2 ? ['flat'] : PIECE_TYPES;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const stack = board[row][col];

      if (stack.length === 0) {
        // Placement candidates
        for (const pieceType of pieceTypes) {
          if (pieceType === 'capstone' && players[currentPlayer].capstoneCount === 0) continue;
          const move: Move = { kind: 'place', pieceType, row, col };
          if (validateMove(state, move) === null) moves.push(move);
        }
      } else if (turnNumber > 2) {
        // Slide candidates — only own stacks, no slides on swap turns
        const top = stack.at(-1);
        if (!top || top.color !== currentPlayer) continue;
        const maxPickup = Math.min(size, stack.length);
        for (let count = 1; count <= maxPickup; count++) {
          for (const direction of DIRECTIONS) {
            const drops = computeDrops(board, size, row, col, direction, count);
            if (drops.length === 0) continue;
            const move: Move = { kind: 'slide', row, col, direction, drops };
            if (validateMove(state, move) === null) moves.push(move);
          }
        }
      }
    }
  }

  return moves;
}
