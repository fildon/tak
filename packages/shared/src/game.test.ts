import { describe, expect, it } from 'vitest';
import { applyMove, createGame, validateMove } from './game';
import type { GameState, Piece } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const flat = (color: 'white' | 'black'): Piece => ({ type: 'flat', color });
const wall = (color: 'white' | 'black'): Piece => ({ type: 'wall', color });
const cap = (color: 'white' | 'black'): Piece => ({ type: 'capstone', color });

/** Return a copy of state with board[row][col] replaced by the given stack. */
function withStack(state: GameState, row: number, col: number, stack: Piece[]): GameState {
  return {
    ...state,
    board: state.board.map((r, ri) =>
      r.map((s, ci) => (ri === row && ci === col ? [...stack] : s)),
    ),
  };
}

/** Return a copy of state advanced past swap turns, with currentPlayer set. */
function normalTurn(state: GameState, player: 'white' | 'black' = 'white'): GameState {
  return { ...state, turnNumber: 3, currentPlayer: player };
}

// ---------------------------------------------------------------------------
// createGame
// ---------------------------------------------------------------------------

describe('createGame', () => {
  it('creates a 5×5 board with correct piece counts', () => {
    const s = createGame(5);
    expect(s.size).toBe(5);
    expect(s.board).toHaveLength(5);
    expect(s.board[0]).toHaveLength(5);
    expect(s.players.white).toEqual({ flatCount: 21, capstoneCount: 1 });
    expect(s.players.black).toEqual({ flatCount: 21, capstoneCount: 1 });
    expect(s.currentPlayer).toBe('white');
    expect(s.turnNumber).toBe(1);
    expect(s.result).toBeNull();
  });

  it('creates a 3×3 board with correct piece counts', () => {
    const s = createGame(3);
    expect(s.size).toBe(3);
    expect(s.players.white).toEqual({ flatCount: 10, capstoneCount: 0 });
    expect(s.players.black).toEqual({ flatCount: 10, capstoneCount: 0 });
  });

  it('throws for an unsupported board size', () => {
    expect(() => createGame(7)).toThrow('Unsupported board size');
  });
});

// ---------------------------------------------------------------------------
// validateMove — place
// ---------------------------------------------------------------------------

describe('validateMove — place', () => {
  it('accepts valid placement on an empty cell', () => {
    const s = normalTurn(createGame(3));
    expect(validateMove(s, { kind: 'place', pieceType: 'flat', row: 0, col: 0 })).toBeNull();
  });

  it('rejects placement with negative row', () => {
    const s = normalTurn(createGame(3));
    expect(validateMove(s, { kind: 'place', pieceType: 'flat', row: -1, col: 0 })).toBe(
      'Out of bounds',
    );
  });

  it('rejects placement with row ≥ size', () => {
    const s = normalTurn(createGame(3));
    expect(validateMove(s, { kind: 'place', pieceType: 'flat', row: 3, col: 0 })).toBe(
      'Out of bounds',
    );
  });

  it('rejects placement with negative col', () => {
    const s = normalTurn(createGame(3));
    expect(validateMove(s, { kind: 'place', pieceType: 'flat', row: 0, col: -1 })).toBe(
      'Out of bounds',
    );
  });

  it('rejects placement with col ≥ size', () => {
    const s = normalTurn(createGame(3));
    expect(validateMove(s, { kind: 'place', pieceType: 'flat', row: 0, col: 3 })).toBe(
      'Out of bounds',
    );
  });

  it('rejects placement on an occupied cell', () => {
    let s = normalTurn(createGame(3));
    s = withStack(s, 0, 0, [flat('white')]);
    expect(validateMove(s, { kind: 'place', pieceType: 'flat', row: 0, col: 0 })).toBe(
      'Cell is not empty',
    );
  });

  it('accepts flat placement on swap turn 1', () => {
    const s = createGame(3); // turnNumber = 1
    expect(validateMove(s, { kind: 'place', pieceType: 'flat', row: 0, col: 0 })).toBeNull();
  });

  it('accepts flat placement on swap turn 2', () => {
    const s = { ...createGame(3), turnNumber: 2 };
    expect(validateMove(s, { kind: 'place', pieceType: 'flat', row: 0, col: 0 })).toBeNull();
  });

  it('rejects wall placement on a swap turn', () => {
    const s = createGame(3);
    expect(validateMove(s, { kind: 'place', pieceType: 'wall', row: 0, col: 0 })).toBe(
      'Swap turns may only place flat stones',
    );
  });

  it('rejects capstone placement on a swap turn', () => {
    const s = { ...createGame(5), turnNumber: 2 };
    expect(validateMove(s, { kind: 'place', pieceType: 'capstone', row: 0, col: 0 })).toBe(
      'Swap turns may only place flat stones',
    );
  });

  it('rejects flat placement when player has no flats remaining', () => {
    let s = normalTurn(createGame(3));
    s = { ...s, players: { ...s.players, white: { flatCount: 0, capstoneCount: 0 } } };
    expect(validateMove(s, { kind: 'place', pieceType: 'flat', row: 0, col: 0 })).toBe(
      'No flat stones remaining',
    );
  });

  it('rejects capstone placement when player has no capstones remaining', () => {
    let s = normalTurn(createGame(5));
    s = { ...s, players: { ...s.players, white: { flatCount: 21, capstoneCount: 0 } } };
    expect(validateMove(s, { kind: 'place', pieceType: 'capstone', row: 0, col: 0 })).toBe(
      'No capstones remaining',
    );
  });

  it('rejects any move when the game is already over', () => {
    let s = normalTurn(createGame(3));
    s = { ...s, result: { winner: 'white', reason: 'road' } };
    expect(validateMove(s, { kind: 'place', pieceType: 'flat', row: 0, col: 0 })).toBe(
      'Game is already over',
    );
  });
});

// ---------------------------------------------------------------------------
// validateMove — slide
// ---------------------------------------------------------------------------

describe('validateMove — slide', () => {
  /** Base state: turn 3, white flat at (1,1) on a 3×3 board. */
  function slideBase(): GameState {
    let s = normalTurn(createGame(3));
    s = withStack(s, 1, 1, [flat('white')]);
    return s;
  }

  it('accepts a valid single-step slide', () => {
    expect(
      validateMove(slideBase(), { kind: 'slide', row: 1, col: 1, direction: '+', drops: [1] }),
    ).toBeNull();
  });

  it('rejects slide on swap turn 1', () => {
    let s = createGame(3);
    s = withStack(s, 1, 1, [flat('white')]);
    expect(validateMove(s, { kind: 'slide', row: 1, col: 1, direction: '+', drops: [1] })).toBe(
      'Cannot slide on swap turns',
    );
  });

  it('rejects slide on swap turn 2', () => {
    let s = { ...createGame(3), turnNumber: 2 };
    s = withStack(s, 1, 1, [flat('white')]);
    expect(validateMove(s, { kind: 'slide', row: 1, col: 1, direction: '+', drops: [1] })).toBe(
      'Cannot slide on swap turns',
    );
  });

  it('rejects slide from an out-of-bounds source', () => {
    expect(
      validateMove(slideBase(), { kind: 'slide', row: -1, col: 0, direction: '+', drops: [1] }),
    ).toBe('Out of bounds');
  });

  it('rejects slide from an empty cell', () => {
    expect(
      validateMove(slideBase(), { kind: 'slide', row: 0, col: 0, direction: '+', drops: [1] }),
    ).toBe('No pieces at source');
  });

  it('rejects slide when the top piece belongs to the opponent', () => {
    let s = normalTurn(createGame(3));
    s = withStack(s, 1, 1, [flat('black')]);
    expect(validateMove(s, { kind: 'slide', row: 1, col: 1, direction: '+', drops: [1] })).toBe(
      'You do not control this stack',
    );
  });

  it('rejects an empty drops array', () => {
    expect(
      validateMove(slideBase(), { kind: 'slide', row: 1, col: 1, direction: '+', drops: [] }),
    ).toBe('Must specify at least one drop');
  });

  it('rejects a drop value of zero', () => {
    let s = normalTurn(createGame(3));
    s = withStack(s, 1, 1, [flat('white'), flat('white')]);
    expect(validateMove(s, { kind: 'slide', row: 1, col: 1, direction: '+', drops: [0, 1] })).toBe(
      'Each drop must be at least 1',
    );
  });

  it('rejects when carry count exceeds board size', () => {
    // Board size 3; trying to carry 4 pieces (3+1 drop)
    let s = normalTurn(createGame(3));
    s = withStack(s, 1, 1, [flat('white'), flat('white'), flat('white'), flat('white')]);
    expect(
      validateMove(s, { kind: 'slide', row: 1, col: 1, direction: '+', drops: [2, 2] }),
    ).toMatch(/Carry limit/);
  });

  it('rejects when carry count exceeds source stack height', () => {
    // Stack has 1 piece; trying to carry 2
    expect(
      validateMove(slideBase(), { kind: 'slide', row: 1, col: 1, direction: '+', drops: [2] }),
    ).toBe('Not enough pieces in stack');
  });

  it('rejects a slide that goes off the board', () => {
    // White flat at (0,0), sliding north (+) would step to row -1
    let s = normalTurn(createGame(3));
    s = withStack(s, 0, 0, [flat('white')]);
    expect(validateMove(s, { kind: 'slide', row: 0, col: 0, direction: '+', drops: [1] })).toBe(
      'Move goes off the board',
    );
  });

  it('rejects landing on a capstone', () => {
    let s = slideBase();
    s = withStack(s, 0, 1, [cap('black')]); // capstone one step north of (1,1)
    expect(validateMove(s, { kind: 'slide', row: 1, col: 1, direction: '+', drops: [1] })).toBe(
      'Cannot move onto a capstone',
    );
  });

  it('rejects passing through a wall (wall not on last square)', () => {
    // Stack of 3 at (2,0); wall at (1,0) is in the middle of a 2-step slide north
    let s = normalTurn(createGame(3));
    s = withStack(s, 2, 0, [flat('white'), flat('white'), flat('white')]);
    s = withStack(s, 1, 0, [wall('black')]);
    expect(
      validateMove(s, { kind: 'slide', row: 2, col: 0, direction: '+', drops: [1, 1, 1] }),
    ).toBe('Cannot pass through a wall');
  });

  it('accepts a lone capstone flattening a wall on the last square', () => {
    let s = normalTurn(createGame(5));
    s = { ...s, players: { ...s.players, white: { flatCount: 21, capstoneCount: 1 } } };
    s = withStack(s, 2, 2, [cap('white')]);
    s = withStack(s, 1, 2, [wall('black')]);
    expect(
      validateMove(s, { kind: 'slide', row: 2, col: 2, direction: '+', drops: [1] }),
    ).toBeNull();
  });

  it('rejects flattening a wall when last drop is not 1', () => {
    // Trying to drop 2 pieces onto a wall — only a lone capstone may flatten
    let s = normalTurn(createGame(5));
    s = { ...s, players: { ...s.players, white: { flatCount: 21, capstoneCount: 1 } } };
    s = withStack(s, 2, 2, [flat('white'), cap('white')]);
    s = withStack(s, 1, 2, [wall('black')]);
    expect(validateMove(s, { kind: 'slide', row: 2, col: 2, direction: '+', drops: [2] })).toBe(
      'Only a lone capstone can flatten a wall',
    );
  });

  it('rejects flattening a wall when the dropped piece is not a capstone', () => {
    let s = normalTurn(createGame(3));
    s = withStack(s, 2, 0, [flat('white')]);
    s = withStack(s, 1, 0, [wall('black')]);
    expect(validateMove(s, { kind: 'slide', row: 2, col: 0, direction: '+', drops: [1] })).toBe(
      'Only a capstone can flatten a wall',
    );
  });
});

// ---------------------------------------------------------------------------
// applyMove — place
// ---------------------------------------------------------------------------

describe('applyMove — place', () => {
  it('places the opponent piece on swap turns (white places a black flat)', () => {
    const s = createGame(3); // turnNumber = 1, currentPlayer = white
    const next = applyMove(s, { kind: 'place', pieceType: 'flat', row: 0, col: 0 });
    expect(next.board[0][0]).toEqual([flat('black')]);
  });

  it('places the current player piece on normal turns', () => {
    const s = normalTurn(createGame(3));
    const next = applyMove(s, { kind: 'place', pieceType: 'flat', row: 0, col: 0 });
    expect(next.board[0][0]).toEqual([flat('white')]);
  });

  it('decrements the placed player flatCount', () => {
    const s = normalTurn(createGame(3)); // white flatCount = 10
    const next = applyMove(s, { kind: 'place', pieceType: 'flat', row: 0, col: 0 });
    expect(next.players.white.flatCount).toBe(9);
  });

  it('switches currentPlayer after the move', () => {
    const s = normalTurn(createGame(3), 'white');
    const next = applyMove(s, { kind: 'place', pieceType: 'flat', row: 0, col: 0 });
    expect(next.currentPlayer).toBe('black');
  });

  it('increments turnNumber after the move', () => {
    const s = normalTurn(createGame(3)); // turnNumber = 3
    const next = applyMove(s, { kind: 'place', pieceType: 'flat', row: 0, col: 0 });
    expect(next.turnNumber).toBe(4);
  });

  it('appends the move to moveHistory', () => {
    const s = normalTurn(createGame(3));
    const move = { kind: 'place' as const, pieceType: 'flat' as const, row: 0, col: 0 };
    const next = applyMove(s, move);
    expect(next.moveHistory).toHaveLength(1);
    expect(next.moveHistory[0]).toEqual(move);
  });

  it('throws on an invalid move', () => {
    const s = normalTurn(createGame(3));
    expect(() => applyMove(s, { kind: 'place', pieceType: 'flat', row: -1, col: 0 })).toThrow(
      'Invalid move',
    );
  });
});

// ---------------------------------------------------------------------------
// applyMove — slide
// ---------------------------------------------------------------------------

describe('applyMove — slide', () => {
  it('removes pieces from source and places them on the destination', () => {
    let s = normalTurn(createGame(3));
    s = withStack(s, 1, 1, [flat('white')]);
    const next = applyMove(s, { kind: 'slide', row: 1, col: 1, direction: '+', drops: [1] });
    expect(next.board[1][1]).toHaveLength(0); // source emptied
    expect(next.board[0][1]).toEqual([flat('white')]); // landed one row north
  });

  it('distributes pieces across multiple cells', () => {
    // Stack of 2 at (2,1); slide north dropping 1 at (1,1) and 1 at (0,1)
    let s = normalTurn(createGame(3));
    s = withStack(s, 2, 1, [flat('white'), flat('white')]);
    const next = applyMove(s, { kind: 'slide', row: 2, col: 1, direction: '+', drops: [1, 1] });
    expect(next.board[2][1]).toHaveLength(0);
    expect(next.board[1][1]).toEqual([flat('white')]);
    expect(next.board[0][1]).toEqual([flat('white')]);
  });

  it('capstone flattens a wall: wall becomes flat, capstone lands on top', () => {
    let s = normalTurn(createGame(5));
    s = { ...s, players: { ...s.players, white: { flatCount: 21, capstoneCount: 1 } } };
    s = withStack(s, 2, 2, [cap('white')]);
    s = withStack(s, 1, 2, [wall('black')]);
    const next = applyMove(s, { kind: 'slide', row: 2, col: 2, direction: '+', drops: [1] });
    expect(next.board[1][2]).toEqual([flat('black'), cap('white')]); // wall flattened, cap on top
    expect(next.board[2][2]).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Win detection — road
// ---------------------------------------------------------------------------

describe('win detection — road', () => {
  it('detects a white top-to-bottom road win', () => {
    // Pre-fill column 0, rows 0-1 with white flats; placing row 2 completes the road
    let s = normalTurn(createGame(3), 'white');
    s = withStack(s, 0, 0, [flat('white')]);
    s = withStack(s, 1, 0, [flat('white')]);
    const next = applyMove(s, { kind: 'place', pieceType: 'flat', row: 2, col: 0 });
    expect(next.result).toEqual({ winner: 'white', reason: 'road' });
  });

  it('detects a black left-to-right road win', () => {
    // Black fills row 1; white makes an irrelevant move in between
    let s = normalTurn(createGame(3), 'white');
    s = withStack(s, 1, 0, [flat('black')]);
    s = withStack(s, 1, 1, [flat('black')]);
    // White moves somewhere irrelevant; then black completes the road
    const afterWhite = applyMove(s, { kind: 'place', pieceType: 'flat', row: 0, col: 2 });
    const next = applyMove(afterWhite, { kind: 'place', pieceType: 'flat', row: 1, col: 2 });
    expect(next.result).toEqual({ winner: 'black', reason: 'road' });
  });

  it('a wall does not contribute to a road', () => {
    // Column 0 would be a white road, but the middle cell is a wall
    let s = normalTurn(createGame(3), 'white');
    s = withStack(s, 0, 0, [flat('white')]);
    s = withStack(s, 1, 0, [wall('white')]); // wall breaks connectivity
    s = withStack(s, 2, 0, [flat('white')]);
    // Place a flat elsewhere; no road should be detected
    const next = applyMove(s, { kind: 'place', pieceType: 'flat', row: 0, col: 1 });
    expect(next.result).toBeNull();
  });

  it('simultaneous road: the current player (mover) wins', () => {
    // Both roads already exist before the move-checking step.
    // Manually inject a result-free state where both roads are present after white's slide.
    // Simpler: set up so white's placement creates both roads simultaneously.
    // White column 0 rows 0-1 + black row 2 cols 0-1 already set.
    // White places at (2,0): completes white col-0 road (rows 0-2) AND sits in black's row-2.
    // But (2,0) becomes a white flat, not black — it won't give black a road.
    //
    // Correct approach: pre-fill so that white's move at cell X gives BOTH players a road.
    // White: (0,1),(1,1) need (2,1). Black: (2,0),(2,2) need (2,1).
    // If white places a white flat at (2,1): white gets col-1 road; (2,1) is white so black doesn't get row-2.
    //
    // Use a slide instead: white slides onto (2,1) and the cell below it already connects black.
    // Actually the simplest valid simultaneous case: both players already have a road when checkWin runs.
    // We can engineer this by putting the state right before a slide that "completes" white's road
    // while black's road is already complete (but check only runs after a move).
    //
    // Hack: inject a state where both roads exist and call applyMove for a move that doesn't change roads.
    // But validateMove won't allow moves once result is set...
    //
    // Cleanest approach: test the case where a slide creates both roads.
    // White has (0,0),(1,0),(2,0) — a complete white road already (col 0 top-to-bottom) ✓
    // but we need to make it happen simultaneously with black.
    //
    // Actually, let's just verify that `checkWin` returns `currentPlayer` when both roads exist.
    // We can do this by crafting a state where, mid-check, both `whiteRoad` and `blackRoad` are true.
    // The simplest unit-test path: manually set a state with both roads present, then call applyMove
    // with a move that changes nothing strategically, and verify the winner = currentPlayer.
    // But applyMove internally calls checkWin on the state AFTER the move.
    //
    // Minimal reproducer on 3×3:
    // After white's slide, white connects top-to-bottom AND black connects left-to-right.
    // Pre-move board:
    //   (0,0)=W  (0,1)=W  (0,2)=?
    //   (1,0)=B  (1,1)=W  (1,2)=B
    //   (2,0)=B  (2,1)=?  (2,2)=B
    // White slides from (1,1) south dropping on (2,1):
    //   After: (0,0)W-(1,1 empty)-(2,1)W — but that's not a road (no (1,0) white).
    // Different plan: after white's move at (1,0):
    //   White fills column 0 (0,0),(1,0),(2,0) — wait (1,0)=B already.
    //
    // Simplest valid test: set board so white placing a flat completes BOTH roads at once.
    // White needs (0,0)-(1,0) + place (2,0) for top-bottom road.
    // Simultaneously, black needs a left-right road that passes through (2,0)? No — (2,0) becomes white.
    //
    // The simultaneous case typically happens via a slide: white slides a stack that creates white's road
    // AND the stack passing over creates black's road somehow — but that's complex.
    //
    // Realistic approach: inject the simultaneous state directly.
    // Set currentPlayer = 'white', place white's final road piece, but also have black's road already there.
    // Since checkWin runs AFTER the move, we need black's road present after white places.
    //
    // Black left-to-right: (1,0),(1,1),(1,2) all black.
    // White top-to-bottom: (0,0),(1,0),(2,0) — but (1,0) is black!
    //   Actually the road rule is based on the TOP of each stack. If (1,0) has [flat(black), flat(white)],
    //   the top is white — white's road can use it. And black can't use it (top is white).
    // So: (1,0) has stack [flat(black), flat(white)] — top is white.
    //   White col-0: (0,0)=W, (1,0)=[B,W]=W-top ✓, (2,0)=W → white road ✓
    //   Black row-1: (1,0)=[B,W]=W-top ✗ — black's road is broken!
    //
    // Let's try: black road is row 2, white road is col 2.
    // White: (0,2),(1,2) pre-placed; white places (2,2) → white col-2 road ✓
    // Black: (2,0),(2,1) pre-placed; after white places (2,2)... (2,2) is white flat.
    //   Black row-2: (2,0)=B, (2,1)=B, (2,2)=W-top → black road broken ✗
    //
    // The simultaneous road is only possible when the same cell can serve both roads — impossible
    // unless a SLIDE drops a piece onto an intersection that both roads need. On a 3×3 it's really hard.
    //
    // Let's use a 4×4 board or just test this at a higher level by checking the rule holds.
    // Actually: I'll test the simultaneous rule by injecting it directly into checkWin's input.
    // checkWin is private, but we can replicate the input condition:
    // After a white slide that lands a white piece on black's road cell, with black's road EXISTING.
    //
    // Simplest valid simultaneous on 3×3: white slides from (1,1) east, dropping 1 at (1,2).
    // Pre-board:
    //   (0,2)=W, (2,2)=W  → white would have col-2 road if (1,2) becomes white ✓
    //   (1,0)=B, (1,1)=[W,W] with a B underneath? No...
    // This is getting complicated. Let me try the most direct path:
    //
    // White places at (1,0), which completes white's col-0 road: (0,0),(1,0),(2,0).
    // At that same time, black's row-1 road (1,0),(1,1),(1,2) would need (1,0) to be black on top.
    // Since white places at (1,0), its top is white — black can't use it for a road.
    //
    // Conclusion: simultaneous roads on a 3×3 board via a *place* move are essentially impossible
    // because placing gives one color ownership of the cell, breaking the other's use of it.
    // Via a SLIDE (where pieces pass over intermediate cells), it's possible.
    //
    // For simplicity, test simultaneous via a slide on a 5×5 board.
    // White col-2: (0,2),(1,2) white; black row-4: (4,0),(4,1),(4,2),(4,3) black.
    // White slides from (2,2) south with 3 drops: [1,1,1], landing at (3,2),(4,2)...
    // (4,2) already has black — capstone needed to flatten? This is getting complicated.
    //
    // I'll use the minimal direct approach: set state so white places a flat that completes
    // white's vertical road, while black already has a COMPLETE horizontal road formed by
    // the EXISTING board state (independent of white's move). To achieve this, I need black's
    // road to not use the cell white is placing on.
    //
    // White places (2,0): completes white col-0 = (0,0),(1,0),(2,0) ✓
    // Black row-2: (2,0),(2,1),(2,2) — but (2,0) will be white after white places. ✗
    //
    // Black row-0: (0,1),(0,2) + ??? — (0,0) is white, can't use it.
    // Black needs 3 connected cells from left edge to right edge = entire row (3×3).
    // Any row that includes col 0 and col 2 must include col 1 for a 3×3.
    //
    // If white places at (2,0) and black's road is row 1: (1,0),(1,1),(1,2) all black.
    // But then white places a *white* flat at (2,0), which doesn't affect row 1's tops.
    // After white places at (2,0): white col-0 = (0,0),(1,0),...(2,0). But (1,0) is black!
    // White road needs tops to be white (or capstone). If (1,0) is a black flat, it doesn't count for white.
    //
    // OK. I think the ONLY way to get a simultaneous road is via a slide. Let me construct one:
    //
    // Board setup for 5×5, white current player:
    // White has col-0 road almost complete: (0,0),(1,0),(3,0),(4,0) white flats. Missing (2,0).
    // Black has row-2 road almost complete: (2,1),(2,2),(2,3),(2,4) black flats. Missing (2,0).
    // White at (2,1) has a white flat. White slides west from (2,1): drops 1 at (2,0).
    // After slide: (2,0) gets white flat on top → white road col-0 completes ✓
    //              but (2,0) top is white, so black can't use it for row-2 ✗
    //
    // WAIT. The checkWin code says:
    //   if (whiteRoad || blackRoad) { winner = whiteRoad && blackRoad ? currentPlayer : ... }
    // So both roads need to be detected. Black's road through (2,0) with a white top won't work.
    //
    // The simultaneous case requires each player's road to go through DIFFERENT cells.
    // White's road and black's road must be on separate parts of the board.
    //
    // Example:
    // White road: column 0 (top-to-bottom)
    // Black road: row 4 (left-to-right, 5×5)
    // These share cell (4,0)!
    //
    // Setup: white pre-fills (0,0),(1,0),(2,0),(3,0) white. Black pre-fills (4,1),(4,2),(4,3),(4,4) black.
    // White places at (4,0):
    //   White road col-0: (0,0),(1,0),(2,0),(3,0),(4,0) ✓
    //   Black road row-4: (4,0),(4,1),(4,2),(4,3),(4,4) — (4,0) top is white ✗
    // Still broken.
    //
    // The key insight: roads are evaluated INDEPENDENTLY for each color based on what's on top.
    // For both roads to exist simultaneously, each road must only use cells where THAT COLOR is on top.
    // Two roads can exist simultaneously only if they share no cells (or the shared cell somehow has BOTH colors on top — impossible).
    //
    // On a 3×3, can white have a top-bottom road AND black have a left-right road with NO shared cells?
    // White top-bottom: uses 3 cells in a column (3 cells).
    // Black left-right: uses 3 cells in a row (3 cells).
    // They intersect at 1 cell. That cell can't be both white-top and black-top.
    //
    // UNLESS the white road goes diagonally? No — BFS only goes up/down/left/right.
    // Actually it CAN go non-straight! White's road can go in an L-shape:
    // White road: (0,0),(0,1),(0,2),(1,2),(2,2) — top row then right column. Uses cells (0,0-2),(1,2),(2,2).
    // Black road: (0,0),(1,0),(2,0) — left column. Uses (0,0),(1,0),(2,0).
    // Shared cell: (0,0) — can't be both.
    //
    // White road: (0,0),(1,0),(2,0) — left column, top-to-bottom.
    // Black road: (0,2),(1,2),(2,2) — right column, top-to-bottom. (Also counts as top-to-bottom for black).
    // WAIT — both are top-to-bottom roads! They DON'T share cells! (0,0) and (0,2) etc.
    //
    // Yes! Both players can have top-to-bottom roads on different columns!
    // White: col 0 (0,0),(1,0),(2,0)
    // Black: col 2 (0,2),(1,2),(2,2)
    // No shared cells ✓ Each is a valid top-to-bottom road ✓
    //
    // Setup for simultaneous road test:
    // White pre-fills: (0,0),(1,0),(2,0) — but wait, if white has a full road before the game ends,
    // applyMove would detect it immediately when those pieces were placed. So we can't get to a state
    // where white already has a full road and the game is still going.
    //
    // UNLESS we inject the state manually, bypassing normal move application.
    // That's exactly what our test helpers allow! We manually set up the board state.
    // Set `result: null` on the state (so the game is "still going" in our view), put pieces on board,
    // then call `applyMove` which will call `checkWin` and detect both roads.
    //
    // But applyMove calls validateMove first. validateMove checks `result !== null`. If result is null,
    // it proceeds. So we inject a state where result=null but both roads effectively exist, and the
    // next move just needs to not break anything.
    //
    // Actually wait: if black already has a road but result is null (because we injected it), then
    // when white makes a move, checkWin runs and detects both roads → currentPlayer (white) wins.
    //
    // Let me implement it:
    // State: result=null, currentPlayer='white'
    // Board: (0,0),(1,0),(2,0) = white flats (white has col-0 road)
    //        (0,2),(1,2),(2,2) = black flats (black has col-2 road)
    // White makes a harmless move: place flat at (0,1)
    // checkWin detects both roads → winner = currentPlayer = 'white'
    //
    let s = normalTurn(createGame(3), 'white');
    s = withStack(s, 0, 0, [flat('white')]);
    s = withStack(s, 1, 0, [flat('white')]);
    s = withStack(s, 2, 0, [flat('white')]); // white already has col-0 road
    s = withStack(s, 0, 2, [flat('black')]);
    s = withStack(s, 1, 2, [flat('black')]);
    s = withStack(s, 2, 2, [flat('black')]); // black already has col-2 road
    // White places anywhere; checkWin detects both roads → currentPlayer (white) wins
    const next = applyMove(s, { kind: 'place', pieceType: 'flat', row: 0, col: 1 });
    expect(next.result).toEqual({ winner: 'white', reason: 'road' });
  });
});

// ---------------------------------------------------------------------------
// Win detection — flat count
// ---------------------------------------------------------------------------

describe('win detection — flat count', () => {
  /**
   * Checkerboard layout for a 3×3 board with no roads for either player.
   * W B W        white flats at (0,0),(0,2),(1,1),(2,0),(2,2)
   * B W B   →   black flats at (0,1),(1,0),(1,2),(2,1)
   * W B W
   * Neither player has a connected path from one edge to the opposite edge.
   */
  function checkerboard(leaveEmpty: [number, number]): GameState {
    const layout: Array<[number, number, 'white' | 'black']> = [
      [0, 0, 'white'],
      [0, 1, 'black'],
      [0, 2, 'white'],
      [1, 0, 'black'],
      [1, 1, 'white'],
      [1, 2, 'black'],
      [2, 0, 'white'],
      [2, 1, 'black'],
      [2, 2, 'white'],
    ].filter(([r, c]) => !(r === leaveEmpty[0] && c === leaveEmpty[1])) as Array<
      [number, number, 'white' | 'black']
    >;

    let s = normalTurn(createGame(3), 'white');
    for (const [r, c, color] of layout) {
      s = withStack(s, r, c, [flat(color)]);
    }
    return s;
  }

  it('player with more flat-topped pieces wins when board is full', () => {
    // Leave (2,2) empty; white places there → 5 white flats vs 4 black flats → white wins
    const s = checkerboard([2, 2]);
    const next = applyMove(s, { kind: 'place', pieceType: 'flat', row: 2, col: 2 });
    expect(next.result).toEqual({ winner: 'white', reason: 'flats' });
  });

  it('equal flat counts result in a draw', () => {
    // Replace (2,2) white with a wall (top is non-flat, so it doesn't count).
    // Board: 4 white flats, 4 black flats, 1 wall at (2,2) — 8 occupied cells.
    // White places flat at (0,2) — wait, (0,2) is already occupied in checkerboard.
    // Instead: build 8 cells with 3 white flats + 4 black flats + 1 wall (3+4+1=8).
    // White places the 9th flat → 4 white vs 4 black → draw.
    // Layout: leave (2,2) empty; put wall at (0,2) instead of white flat.
    let s = normalTurn(createGame(3), 'white');
    s = withStack(s, 0, 0, [flat('white')]);
    s = withStack(s, 0, 1, [flat('black')]);
    s = withStack(s, 0, 2, [wall('white')]); // wall — doesn't count as a flat
    s = withStack(s, 1, 0, [flat('black')]);
    s = withStack(s, 1, 1, [flat('white')]);
    s = withStack(s, 1, 2, [flat('black')]);
    s = withStack(s, 2, 0, [flat('white')]);
    s = withStack(s, 2, 1, [flat('black')]);
    // Before placing: 3 white flats, 4 black flats (wall at 0,2 doesn't count)
    // White places flat at (2,2) → 4 white flats, 4 black flats → draw
    const next = applyMove(s, { kind: 'place', pieceType: 'flat', row: 2, col: 2 });
    expect(next.result).toEqual({ winner: null, reason: 'draw' });
  });
});
