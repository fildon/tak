import { useEffect, useReducer, useState } from 'react';
import {
  applyMove,
  createGame,
  validateMove,
} from '@tak/shared';
import type { Color, Direction, GameState, Move, PieceType, PlaceMove, SlideMove } from '@tak/shared';
import type { UIPhase } from '../types/uiState';
import type { CpuColor, GameMode } from '../types/gameMode';
import { computeDrops } from '../utils/moves';
import { getCpuMove } from '../cpu/getCpuMove';

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

export interface StartGameOpts {
  mode: GameMode;
  cpuColor: CpuColor;
  size: number;
}

export interface UseGameStateReturn {
  gameState: GameState;
  uiPhase: UIPhase;
  gameMode: GameMode;
  cpuColor: CpuColor;
  selectPieceType: (pt: PieceType) => void;
  selectStack: (row: number, col: number) => void;
  setSlideCount: (n: number) => void;
  clickCell: (row: number, col: number) => void;
  clickDirection: (dir: Direction) => void;
  setDropAt: (index: number, value: number) => void;
  removeLastStep: () => void;
  addStep: () => void;
  confirmSlide: () => void;
  startGame: (opts: StartGameOpts) => void;
  cancelSelection: () => void;
}

export function useGameState(): UseGameStateReturn {
  const [gameState, dispatch] = useReducer(gameReducer, undefined, () => createGame(5));
  const [uiPhase, setUiPhase] = useState<UIPhase>({ phase: 'idle' });
  const [gameMode, setGameMode] = useState<GameMode>('pvp');
  const [cpuColor, setCpuColor] = useState<CpuColor>('black');

  // Auto-enter placing mode on swap turns (turns 1 & 2)
  useEffect(() => {
    if (gameState.turnNumber <= 2 && gameState.result === null) {
      setUiPhase({ phase: 'placing', pieceType: 'flat' });
    }
  }, [gameState.turnNumber, gameState.result]);

  // CPU move trigger
  useEffect(() => {
    if (gameMode !== 'pvc') return;
    if (gameState.currentPlayer !== cpuColor) return;
    if (gameState.result !== null) return;

    setUiPhase({ phase: 'cpu-thinking' });
    const timer = setTimeout(() => {
      const move = getCpuMove(gameState);
      dispatch({ type: 'APPLY_MOVE', move });
      setUiPhase({ phase: 'idle' });
    }, 400);
    return () => clearTimeout(timer);
  }, [gameState, gameMode, cpuColor]);

  const selectPieceType = (pt: PieceType) => {
    if (uiPhase.phase === 'cpu-thinking') return;
    if (gameState.turnNumber <= 2) return;
    setUiPhase((prev) =>
      prev.phase === 'placing' && prev.pieceType === pt
        ? { phase: 'idle' }
        : { phase: 'placing', pieceType: pt },
    );
  };

  const selectStack = (row: number, col: number) => {
    if (uiPhase.phase === 'cpu-thinking' || uiPhase.phase === 'distributing') return;
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

  // Clicking a direction now enters distributing mode instead of applying immediately.
  const clickDirection = (dir: Direction) => {
    if (uiPhase.phase !== 'sliding') return;
    const { row, col, count } = uiPhase;
    const drops = computeDrops(gameState.board, gameState.size, row, col, dir, count);
    if (drops.length === 0) return;
    setUiPhase({ phase: 'distributing', row, col, count, direction: dir, drops, maxSteps: drops.length });
  };

  const setDropAt = (index: number, value: number) => {
    if (uiPhase.phase !== 'distributing') return;
    const drops = [...uiPhase.drops];
    drops[index] = Math.max(1, value);
    setUiPhase({ ...uiPhase, drops });
  };

  // Merge the last step into the previous one, shortening the slide path.
  const removeLastStep = () => {
    if (uiPhase.phase !== 'distributing' || uiPhase.drops.length <= 1) return;
    const drops = [...uiPhase.drops];
    const last = drops.pop()!;
    drops[drops.length - 1] += last;
    setUiPhase({ ...uiPhase, drops });
  };

  // Split the last step to extend the path by one cell (only possible when
  // the path hasn't already reached its maximum and the last step has > 1 piece).
  const addStep = () => {
    if (uiPhase.phase !== 'distributing') return;
    if (uiPhase.drops.length >= uiPhase.maxSteps) return;
    const drops = [...uiPhase.drops];
    if (drops[drops.length - 1] <= 1) return;
    drops[drops.length - 1] -= 1;
    drops.push(1);
    setUiPhase({ ...uiPhase, drops });
  };

  const confirmSlide = () => {
    if (uiPhase.phase !== 'distributing') return;
    const { row, col, direction, drops, count } = uiPhase;
    if (drops.some((d) => d < 1)) return;
    if (drops.reduce((a, b) => a + b, 0) !== count) return;
    const move: SlideMove = { kind: 'slide', row, col, direction, drops };
    if (validateMove(gameState, move) !== null) return;
    dispatch({ type: 'APPLY_MOVE', move });
    setUiPhase({ phase: 'idle' });
  };

  const startGame = (opts: StartGameOpts) => {
    setGameMode(opts.mode);
    setCpuColor(opts.cpuColor);
    dispatch({ type: 'NEW_GAME', size: opts.size });
    // Every new game starts at turnNumber 1 (swap turn). Set placing directly
    // rather than relying on the swap-turn effect, which only fires when
    // turnNumber *changes* — it stays at 1 if no moves were made before reset.
    setUiPhase({ phase: 'placing', pieceType: 'flat' });
  };

  // Cancel distributing → return to sliding so the user can pick a different direction.
  // Cancel anything else → idle.
  const cancelSelection = () => {
    if (uiPhase.phase === 'distributing') {
      const { row, col, count } = uiPhase;
      const maxCount = Math.min(gameState.size, gameState.board[row][col].length);
      setUiPhase({ phase: 'sliding', row, col, count, maxCount });
    } else {
      setUiPhase({ phase: 'idle' });
    }
  };

  return {
    gameState,
    uiPhase,
    gameMode,
    cpuColor,
    selectPieceType,
    selectStack,
    setSlideCount,
    clickCell,
    clickDirection,
    setDropAt,
    removeLastStep,
    addStep,
    confirmSlide,
    startGame,
    cancelSelection,
  };
}
