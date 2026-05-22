import { useEffect, useReducer, useState } from 'react';
import {
  applyMove,
  createGame,
  validateMove,
} from '@tak/shared';
import type { Color, Direction, GameState, Move, PieceType, PlaceMove, SlideMove } from '@tak/shared';
import type { UIPhase } from '../types/uiState';
import { computeDrops } from '../utils/moves';

type GameAction =
  | { type: 'APPLY_MOVE'; move: Move }
  | { type: 'NEW_GAME'; size: number };

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'APPLY_MOVE':
      return applyMove(state, action.move);
    case 'NEW_GAME':
      return createGame(action.size);
  }
}

export interface UseGameStateReturn {
  gameState: GameState;
  uiPhase: UIPhase;
  selectPieceType: (pt: PieceType) => void;
  selectStack: (row: number, col: number) => void;
  setSlideCount: (n: number) => void;
  clickCell: (row: number, col: number) => void;
  clickDirection: (dir: Direction) => void;
  newGame: (size: number) => void;
  cancelSelection: () => void;
}

export function useGameState(): UseGameStateReturn {
  const [gameState, dispatch] = useReducer(gameReducer, undefined, () => createGame(5));
  const [uiPhase, setUiPhase] = useState<UIPhase>({ phase: 'idle' });

  // Auto-enter placing mode on swap turns (turns 1 & 2)
  useEffect(() => {
    if (gameState.turnNumber <= 2 && gameState.result === null) {
      setUiPhase({ phase: 'placing', pieceType: 'flat' });
    }
  }, [gameState.turnNumber, gameState.result]);

  const selectPieceType = (pt: PieceType) => {
    if (gameState.turnNumber <= 2) return; // locked to flat on swap turns
    setUiPhase((prev) =>
      prev.phase === 'placing' && prev.pieceType === pt
        ? { phase: 'idle' }
        : { phase: 'placing', pieceType: pt },
    );
  };

  const selectStack = (row: number, col: number) => {
    if (uiPhase.phase === 'sliding' && uiPhase.row === row && uiPhase.col === col) {
      setUiPhase({ phase: 'idle' });
      return;
    }
    const stack = gameState.board[row][col];
    const top = stack.at(-1);
    if (!top || top.color !== gameState.currentPlayer) return;
    const maxCount = Math.min(gameState.size, stack.length);
    setUiPhase({ phase: 'sliding', row, col, count: maxCount, maxCount });
  };

  const setSlideCount = (n: number) => {
    if (uiPhase.phase !== 'sliding') return;
    const clamped = Math.max(1, Math.min(uiPhase.maxCount, n));
    setUiPhase({ ...uiPhase, count: clamped });
  };

  const clickCell = (row: number, col: number) => {
    if (uiPhase.phase !== 'placing') return;
    const move: PlaceMove = { kind: 'place', pieceType: uiPhase.pieceType, row, col };
    if (validateMove(gameState, move) !== null) return;
    dispatch({ type: 'APPLY_MOVE', move });
    setUiPhase({ phase: 'idle' });
  };

  const clickDirection = (dir: Direction) => {
    if (uiPhase.phase !== 'sliding') return;
    const { row, col, count } = uiPhase;
    const drops = computeDrops(gameState.board, gameState.size, row, col, dir, count);
    if (drops.length === 0) return;
    const move: SlideMove = { kind: 'slide', row, col, direction: dir, drops };
    if (validateMove(gameState, move) !== null) return;
    dispatch({ type: 'APPLY_MOVE', move });
    setUiPhase({ phase: 'idle' });
  };

  const newGame = (size: number) => {
    dispatch({ type: 'NEW_GAME', size });
    setUiPhase({ phase: 'idle' });
  };

  const cancelSelection = () => setUiPhase({ phase: 'idle' });

  return {
    gameState,
    uiPhase,
    selectPieceType,
    selectStack,
    setSlideCount,
    clickCell,
    clickDirection,
    newGame,
    cancelSelection,
  };
}
