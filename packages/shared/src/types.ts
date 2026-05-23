export type PieceType = 'flat' | 'wall' | 'capstone';
export type Color = 'white' | 'black';
export type Direction = '+' | '-' | '<' | '>';

export interface Piece {
  type: PieceType;
  color: Color;
}

/** A cell's piece stack, bottom-first. */
export type Stack = Piece[];

/** The board: board[row][col], row 0 = top (rank n), col 0 = left (file a). */
export type Board = Stack[][];

export interface PlayerState {
  flatCount: number;
  capstoneCount: number;
}

export interface PlaceMove {
  kind: 'place';
  pieceType: PieceType;
  row: number;
  col: number;
}

export interface SlideMove {
  kind: 'slide';
  row: number;
  col: number;
  direction: Direction;
  /**
   * How many pieces to drop at each successive square.
   * Length = number of squares traversed; sum = pieces picked up.
   * Each entry must be >= 1.
   */
  drops: number[];
}

export type Move = PlaceMove | SlideMove;

export interface GameResult {
  /**
   * The winning player, or `null` when the game ends in a draw
   * (equal flat counts at board-full / piece-exhaustion).
   */
  winner: Color | null;
  reason: 'road' | 'flats' | 'draw' | 'resign';
}

export interface GameState {
  board: Board;
  size: number;
  /**
   * The player who acts next.
   * Turns 1 and 2 are the swap turns: each player places the opponent's flat.
   */
  currentPlayer: Color;
  players: Record<Color, PlayerState>;
  moveHistory: Move[];
  result: GameResult | null;
  /** 1-indexed. Turns 1 & 2 are swap turns; normal play starts at turn 3. */
  turnNumber: number;
}
