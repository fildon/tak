import { DIRECTION_DELTA, PIECE_COUNTS } from './constants';
import type {
  Board,
  Color,
  GameResult,
  GameState,
  Move,
  Piece,
  PlaceMove,
  PlayerState,
  SlideMove,
  Stack,
} from './types';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGame(size: number = 5): GameState {
  if (!(size in PIECE_COUNTS)) {
    throw new Error(
      `Unsupported board size: ${size}. Supported: ${Object.keys(PIECE_COUNTS).join(', ')}`,
    );
  }
  const { flats, capstones } = PIECE_COUNTS[size];
  const board: Board = Array.from({ length: size }, () =>
    Array.from({ length: size }, (): Stack => []),
  );
  return {
    board,
    size,
    currentPlayer: 'white',
    players: {
      white: { flatCount: flats, capstoneCount: capstones },
      black: { flatCount: flats, capstoneCount: capstones },
    },
    moveHistory: [],
    result: null,
    turnNumber: 1,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function opponent(color: Color): Color {
  return color === 'white' ? 'black' : 'white';
}

function topOf(stack: Stack): Piece | undefined {
  return stack[stack.length - 1];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Returns null if the move is legal, or an error string if not. */
export function validateMove(state: GameState, move: Move): string | null {
  if (state.result !== null) return 'Game is already over';
  if (move.kind === 'place') return validatePlace(state, move);
  return validateSlide(state, move);
}

function validatePlace(state: GameState, move: PlaceMove): string | null {
  const { row, col, pieceType } = move;
  const { board, size, currentPlayer, players, turnNumber } = state;

  if (row < 0 || row >= size || col < 0 || col >= size) return 'Out of bounds';
  if (board[row][col].length > 0) return 'Cell is not empty';

  if (turnNumber <= 2) {
    if (pieceType !== 'flat') return 'Swap turns may only place flat stones';
    return null;
  }

  const player = players[currentPlayer];
  if (pieceType === 'capstone') {
    if (player.capstoneCount <= 0) return 'No capstones remaining';
  } else {
    if (player.flatCount <= 0) return 'No flat stones remaining';
  }
  return null;
}

function validateSlide(state: GameState, move: SlideMove): string | null {
  if (state.turnNumber <= 2) return 'Cannot slide on swap turns';

  const { row, col, direction, drops } = move;
  const { board, size, currentPlayer } = state;

  if (row < 0 || row >= size || col < 0 || col >= size) return 'Out of bounds';

  const sourceStack = board[row][col];
  if (sourceStack.length === 0) return 'No pieces at source';

  const top = topOf(sourceStack)!;
  if (top.color !== currentPlayer) return 'You do not control this stack';

  if (drops.length === 0) return 'Must specify at least one drop';
  if (drops.some((d) => d < 1)) return 'Each drop must be at least 1';

  const count = drops.reduce((a, b) => a + b, 0);
  if (count > size) return `Carry limit is ${size} (board size)`;
  if (count > sourceStack.length) return 'Not enough pieces in stack';

  const [dr, dc] = DIRECTION_DELTA[direction];
  const pickedUp = sourceStack.slice(sourceStack.length - count);
  let r = row + dr;
  let c = col + dc;
  let offset = 0;

  for (let i = 0; i < drops.length; i++) {
    if (r < 0 || r >= size || c < 0 || c >= size) return 'Move goes off the board';

    const dest = board[r][c];
    const destTop = topOf(dest);
    if (destTop) {
      if (destTop.type === 'capstone') return 'Cannot move onto a capstone';
      if (destTop.type === 'wall') {
        if (i < drops.length - 1) return 'Cannot pass through a wall';
        // Only a lone capstone may flatten a wall on the final square
        if (drops[i] !== 1) return 'Only a lone capstone can flatten a wall';
        const dropping = pickedUp[offset];
        if (dropping.type !== 'capstone') return 'Only a capstone can flatten a wall';
      }
    }

    offset += drops[i];
    r += dr;
    c += dc;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

/** Applies a validated move and returns the new state (immutable). Throws on illegal moves. */
export function applyMove(state: GameState, move: Move): GameState {
  const err = validateMove(state, move);
  if (err) throw new Error(`Invalid move: ${err}`);

  let next = move.kind === 'place' ? applyPlace(state, move) : applySlide(state, move);
  next = checkWin(next);

  if (next.result === null) {
    next = {
      ...next,
      currentPlayer: opponent(next.currentPlayer),
      turnNumber: next.turnNumber + 1,
    };
  }

  return next;
}

function applyPlace(state: GameState, move: PlaceMove): GameState {
  const { row, col, pieceType } = move;
  const { turnNumber, currentPlayer } = state;

  // Swap turns: current player places the opponent's piece
  const pieceColor: Color = turnNumber <= 2 ? opponent(currentPlayer) : currentPlayer;
  const piece = { type: pieceType, color: pieceColor };

  const newBoard = state.board.map((r, ri) =>
    r.map((stack, ci) => (ri === row && ci === col ? [...stack, piece] : stack)),
  );

  const owner = state.players[pieceColor];
  const newOwner: PlayerState =
    pieceType === 'capstone'
      ? { ...owner, capstoneCount: owner.capstoneCount - 1 }
      : { ...owner, flatCount: owner.flatCount - 1 };

  return {
    ...state,
    board: newBoard,
    players: { ...state.players, [pieceColor]: newOwner },
    moveHistory: [...state.moveHistory, move],
  };
}

function applySlide(state: GameState, move: SlideMove): GameState {
  const { row, col, direction, drops } = move;
  const count = drops.reduce((a, b) => a + b, 0);
  const [dr, dc] = DIRECTION_DELTA[direction];

  const newBoard: Board = state.board.map((r) => r.map((stack) => [...stack]));
  const source = newBoard[row][col];
  const hand = source.splice(source.length - count, count);

  let r = row + dr;
  let c = col + dc;
  let offset = 0;

  for (const drop of drops) {
    const dest = newBoard[r][c];
    const destTop = topOf(dest);

    // Capstone flattening a wall
    if (destTop?.type === 'wall' && drop === 1 && hand[offset].type === 'capstone') {
      dest[dest.length - 1] = { ...destTop, type: 'flat' };
    }

    dest.push(...hand.slice(offset, offset + drop));
    offset += drop;
    r += dr;
    c += dc;
  }

  return { ...state, board: newBoard, moveHistory: [...state.moveHistory, move] };
}

// ---------------------------------------------------------------------------
// Win detection
// ---------------------------------------------------------------------------

function checkWin(state: GameState): GameState {
  const { board, size, currentPlayer, players } = state;

  const whiteRoad = hasRoad(board, size, 'white');
  const blackRoad = hasRoad(board, size, 'black');

  if (whiteRoad || blackRoad) {
    // Both roads simultaneously (possible after a slide): mover wins
    const winner: Color = whiteRoad && blackRoad ? currentPlayer : whiteRoad ? 'white' : 'black';
    return withResult(state, { winner, reason: 'road' });
  }

  const boardFull = isFull(board, size);
  const whiteOut = isEmpty(players.white);
  const blackOut = isEmpty(players.black);

  if (boardFull || whiteOut || blackOut) {
    const wf = countFlats(board, size, 'white');
    const bf = countFlats(board, size, 'black');
    if (wf === bf) {
      // Official rules: equal flat count at game end is a draw.
      return withResult(state, { winner: null, reason: 'draw' });
    }
    return withResult(state, { winner: wf > bf ? 'white' : 'black', reason: 'flats' });
  }

  return state;
}

function withResult(state: GameState, result: GameResult): GameState {
  return { ...state, result };
}

function hasRoad(board: Board, size: number, color: Color): boolean {
  const key = (r: number, c: number) => r * size + c;

  const isRoadCell = (r: number, c: number): boolean => {
    const top = topOf(board[r][c]);
    return !!top && top.color === color && top.type !== 'wall';
  };

  const bfs = (
    seeds: Array<[number, number]>,
    goal: (r: number, c: number) => boolean,
  ): boolean => {
    const visited = new Set<number>();
    const queue: Array<[number, number]> = [];
    for (const [r, c] of seeds) {
      if (isRoadCell(r, c)) {
        visited.add(key(r, c));
        queue.push([r, c]);
      }
    }
    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      if (goal(r, c)) return true;
      for (const [nr, nc] of [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ] as Array<[number, number]>) {
        if (
          nr >= 0 &&
          nr < size &&
          nc >= 0 &&
          nc < size &&
          !visited.has(key(nr, nc)) &&
          isRoadCell(nr, nc)
        ) {
          visited.add(key(nr, nc));
          queue.push([nr, nc]);
        }
      }
    }
    return false;
  };

  const topEdge = Array.from<unknown, [number, number]>({ length: size }, (_, c) => [0, c]);
  const leftEdge = Array.from<unknown, [number, number]>({ length: size }, (_, r) => [r, 0]);

  return bfs(topEdge, (r) => r === size - 1) || bfs(leftEdge, (_, c) => c === size - 1);
}

function countFlats(board: Board, size: number, color: Color): number {
  let n = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const top = topOf(board[r][c]);
      if (top?.color === color && top.type === 'flat') n++;
    }
  }
  return n;
}

function isFull(board: Board, size: number): boolean {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c].length === 0) return false;
    }
  }
  return true;
}

function isEmpty(player: PlayerState): boolean {
  return player.flatCount === 0 && player.capstoneCount === 0;
}
