/// eval.rs — static position evaluation.
///
/// Score is always returned from `state.current_player`'s perspective
/// (positive = good for current player).
///
/// Heuristic components:
///   1. Flat/cap count advantage — each road piece on top is +100
///   2. Road progress — BFS-based "furthest reach" from each edge pair,
///      scaled by 60 per row/col of progress
///
/// These are intentionally simple so search depth dominates strength.

use crate::types::*;
use std::collections::VecDeque;

pub const SCORE_WIN: i32 = 1_000_000;

pub fn evaluate(state: &GameState) -> i32 {
    let me = state.current_player;
    let opp = me.opponent();

    // Road-piece count advantage
    let my_pieces = count_road_pieces(&state.board, state.size, me);
    let opp_pieces = count_road_pieces(&state.board, state.size, opp);
    let piece_score = (my_pieces - opp_pieces) * 100;

    // Road connectivity / progress
    let my_progress = road_progress(&state.board, state.size, me);
    let opp_progress = road_progress(&state.board, state.size, opp);
    let road_score = (my_progress - opp_progress) * 60;

    piece_score + road_score
}

// ---------------------------------------------------------------------------
// Flat / capstone count (road pieces on top)
// ---------------------------------------------------------------------------

fn count_road_pieces(board: &[Vec<Vec<Piece>>], size: usize, color: Color) -> i32 {
    let mut n = 0i32;
    for r in 0..size {
        for c in 0..size {
            if let Some(p) = board[r][c].last() {
                if p.color == color && p.typ != PieceType::Wall {
                    n += 1;
                }
            }
        }
    }
    n
}

// ---------------------------------------------------------------------------
// Road progress
// ---------------------------------------------------------------------------

/// Returns the best (furthest) single-axis road-progress score for `color`.
///
/// For each axis (N-S and E-W) we run a BFS from the near edge and measure
/// how many rows/columns deep the connected component reaches.  A completed
/// road scores `size - 1`.  We return the maximum of the two axes.
fn road_progress(board: &[Vec<Vec<Piece>>], size: usize, color: Color) -> i32 {
    let ns = furthest_reach(board, size, color, true);
    let ew = furthest_reach(board, size, color, false);
    ns.max(ew)
}

fn furthest_reach(
    board: &[Vec<Vec<Piece>>],
    size: usize,
    color: Color,
    north_south: bool,
) -> i32 {
    let is_road = |r: usize, c: usize| -> bool {
        board[r][c]
            .last()
            .map_or(false, |p| p.color == color && p.typ != PieceType::Wall)
    };

    let mut visited = vec![false; size * size];
    let mut queue: VecDeque<(usize, usize)> = VecDeque::new();
    let mut best = 0i32;

    // Seed from the near edge.
    for i in 0..size {
        let (r, c) = if north_south { (0, i) } else { (i, 0) };
        if is_road(r, c) && !visited[r * size + c] {
            visited[r * size + c] = true;
            queue.push_back((r, c));
        }
    }

    while let Some((r, c)) = queue.pop_front() {
        let progress = if north_south { r } else { c } as i32;
        if progress > best {
            best = progress;
        }
        // Early-out: reached the far edge.
        if best == (size as i32 - 1) {
            return best;
        }
        for (nr, nc) in neighbours(r, c, size) {
            if !visited[nr * size + nc] && is_road(nr, nc) {
                visited[nr * size + nc] = true;
                queue.push_back((nr, nc));
            }
        }
    }

    best
}

#[inline]
fn neighbours(r: usize, c: usize, size: usize) -> impl Iterator<Item = (usize, usize)> {
    let mut v: [Option<(usize, usize)>; 4] = [None; 4];
    let mut i = 0;
    if r > 0 { v[i] = Some((r - 1, c)); i += 1; }
    if r + 1 < size { v[i] = Some((r + 1, c)); i += 1; }
    if c > 0 { v[i] = Some((r, c - 1)); i += 1; }
    if c + 1 < size { v[i] = Some((r, c + 1)); i += 1; }
    let _ = i;
    v.into_iter().flatten()
}
