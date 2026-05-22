import { useMemo } from 'react';
import { validateMove } from '@tak/shared';
import type { Direction, GameState, PlaceMove, SlideMove } from '@tak/shared';
import type { UIPhase } from '../types/uiState';
import { computeDrops } from '../utils/moves';

const DIRECTIONS: Direction[] = ['+', '-', '<', '>'];

export interface ValidMoves {
  validPlaceCells: Set<string>;
  validDirections: Set<Direction>;
}

export function useValidMoves(gameState: GameState, uiPhase: UIPhase): ValidMoves {
  const validPlaceCells = useMemo(() => {
    const result = new Set<string>();
    if (uiPhase.phase !== 'placing') return result;
    const { pieceType } = uiPhase;
    for (let r = 0; r < gameState.size; r++) {
      for (let c = 0; c < gameState.size; c++) {
        if (gameState.board[r][c].length === 0) {
          const move: PlaceMove = { kind: 'place', pieceType, row: r, col: c };
          if (validateMove(gameState, move) === null) {
            result.add(`${r},${c}`);
          }
        }
      }
    }
    return result;
  }, [gameState, uiPhase]);

  const validDirections = useMemo(() => {
    const result = new Set<Direction>();
    if (uiPhase.phase !== 'sliding') return result;
    const { row, col, count } = uiPhase;
    for (const dir of DIRECTIONS) {
      const drops = computeDrops(gameState.board, gameState.size, row, col, dir, count);
      if (drops.length === 0) continue;
      const move: SlideMove = { kind: 'slide', row, col, direction: dir, drops };
      if (validateMove(gameState, move) === null) {
        result.add(dir);
      }
    }
    return result;
  }, [gameState, uiPhase]);

  return { validPlaceCells, validDirections };
}
