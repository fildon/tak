/// movegen.rs — enumerate all legal moves for the current player.
///
/// Slide generation uses the same "canonical drops" strategy as the TypeScript
/// computeDrops: 1 piece per intermediate cell, all remaining on the last
/// reachable cell.  Every valid (src, direction, count) triple produces exactly
/// one slide move.  This keeps the branching factor tractable while still
/// giving the search full tactical choice of direction and pickup count.

use crate::types::*;

pub fn gen_moves(state: &GameState) -> Vec<Move> {
    let mut moves = Vec::with_capacity(128);
    let size = state.size;
    let cp = state.current_player;

    // On swap turns only flat placements are legal (for the *opponent*'s colour).
    let swap = state.turn_number <= 2;

    for row in 0..size {
        for col in 0..size {
            let stack = &state.board[row][col];

            if stack.is_empty() {
                // ---- Placements ----
                if swap {
                    moves.push(Move::Place { piece_type: PieceType::Flat, row, col });
                } else {
                    let p = state.player(cp);
                    if p.flat_count > 0 {
                        moves.push(Move::Place { piece_type: PieceType::Flat, row, col });
                        moves.push(Move::Place { piece_type: PieceType::Wall, row, col });
                    }
                    if p.capstone_count > 0 {
                        moves.push(Move::Place { piece_type: PieceType::Capstone, row, col });
                    }
                }
            } else if !swap {
                // ---- Slides ----
                let top = *stack.last().unwrap();
                if top.color != cp {
                    continue;
                }
                let max_pickup = (size as u32).min(stack.len() as u32);

                for dir in Direction::ALL {
                    let path = reachable_path(&state.board, size, row, col, dir);
                    if path.is_empty() {
                        continue;
                    }
                    for count in 1..=max_pickup {
                        let drops = canonical_drops(count, &path, stack);
                        if !drops.is_empty() {
                            moves.push(Move::Slide { row, col, direction: dir, drops });
                        }
                    }
                }
            }
        }
    }

    moves
}

// ---------------------------------------------------------------------------
// Path computation
// ---------------------------------------------------------------------------

/// A cell reachable from (row, col) in direction `dir`.
struct PathCell {
    /// The cell has a wall on top — you can only *land* here, not pass through,
    /// and only a lone capstone may flatten it.
    has_wall: bool,
}

/// Returns the sequence of cells reachable in `dir` from (row, col), stopping
/// at board edges, capstones (exclusive) and walls (inclusive — wall cell is
/// the last entry, marked `has_wall`).
fn reachable_path(
    board: &[Vec<Vec<Piece>>],
    size: usize,
    row: usize,
    col: usize,
    dir: Direction,
) -> Vec<PathCell> {
    let (dr, dc) = dir.delta();
    let mut path = Vec::new();
    let mut r = row as i32 + dr;
    let mut c = col as i32 + dc;

    while r >= 0 && r < size as i32 && c >= 0 && c < size as i32 {
        let top = board[r as usize][c as usize].last().copied();
        match top.map(|p| p.typ) {
            Some(PieceType::Capstone) => break, // blocked; cannot land
            Some(PieceType::Wall) => {
                path.push(PathCell { has_wall: true });
                break; // can potentially land (flatten), but cannot pass
            }
            _ => {
                path.push(PathCell { has_wall: false });
            }
        }
        r += dr;
        c += dc;
    }

    path
}

// ---------------------------------------------------------------------------
// Canonical drops
// ---------------------------------------------------------------------------

/// Builds the drops array for a slide of `count` pieces along `path`:
/// drop 1 at each intermediate cell, drop all remaining on the last cell
/// (mirroring the TypeScript `computeDrops`).
///
/// Returns an empty Vec if the move would be illegal (e.g. not enough path
/// to absorb all pieces without violating the wall-flattening rule).
fn canonical_drops(count: u32, path: &[PathCell], stack: &[Piece]) -> Vec<u32> {
    // Can travel at most min(count, path.len()) cells.
    let max_len = (count as usize).min(path.len());
    if max_len == 0 {
        return vec![];
    }

    let last_cell = &path[max_len - 1];

    if last_cell.has_wall {
        // Only a lone capstone may flatten a wall.
        // The last piece we drop must be the top of the original stack
        // (= the last element of the slice we're picking up), which is
        // stack[stack.len() - 1].
        if count != 1 {
            return vec![];
        }
        let top = *stack.last().unwrap();
        if top.typ != PieceType::Capstone {
            return vec![];
        }
        return vec![1]; // single capstone onto the wall
    }

    // Normal case: drop 1 per cell except the last.
    let mut drops = vec![1u32; max_len];
    let distributed = max_len as u32 - 1;
    drops[max_len - 1] = count - distributed;
    drops
}
