/// eval.rs — static position evaluation.
///
/// Score is always returned from `state.current_player`'s perspective
/// (positive = good for current player).
///
/// Heuristic components:
///   1. Flat/cap count advantage     — each road piece on top is ±PIECE_WEIGHT
///   2. Road progress                — BFS-based furthest reach, ±ROAD_PROGRESS_WEIGHT per step
///   3. Threat urgency               — large penalty when opponent is one step from a road
///   4. Flat endgame weighting       — flat advantage scaled by board-fill ratio
///   5. Center control               — road pieces near the board centre score higher
///   6. Stack control                — bonus for owning the top of tall stacks

use crate::types::*;
use std::collections::VecDeque;

pub const SCORE_WIN: i32 = 1_000_000;

// Tunable weights
const PIECE_WEIGHT: i32 = 100;
const ROAD_PROGRESS_WEIGHT: i32 = 60;
const THREAT_PENALTY: i32 = 400;
const FLAT_ENDGAME_WEIGHT: i32 = 80;
const CENTER_WEIGHT: i32 = 15;
const STACK_CONTROL_WEIGHT: i32 = 20;

// ---------------------------------------------------------------------------
// Board statistics (single pass)
// ---------------------------------------------------------------------------

struct BoardStats {
    my_road: i32,    // road pieces (flat/cap) owned by `me` on top
    opp_road: i32,   // road pieces owned by opponent on top
    filled: i32,     // number of non-empty cells
    my_center: i32,  // sum of centre-proximity bonuses for `me`
    opp_center: i32, // sum of centre-proximity bonuses for opponent
    stack_score: i32, // net stack-control score (positive = good for `me`)
}

fn board_stats(board: &[Vec<Vec<Piece>>], size: usize, me: Color) -> BoardStats {
    let center = (size / 2) as i32;
    let mut stats = BoardStats {
        my_road: 0,
        opp_road: 0,
        filled: 0,
        my_center: 0,
        opp_center: 0,
        stack_score: 0,
    };

    for r in 0..size {
        for c in 0..size {
            let stack = &board[r][c];
            if stack.is_empty() {
                continue;
            }
            stats.filled += 1;
            let h = stack.len() as i32;
            let top = stack.last().unwrap();

            // Road piece on top (flat or capstone — not wall)
            if top.typ != PieceType::Wall {
                let dist = (r as i32 - center).abs() + (c as i32 - center).abs();
                let centre_bonus = (center - dist).max(0);
                if top.color == me {
                    stats.my_road += 1;
                    stats.my_center += centre_bonus;
                } else {
                    stats.opp_road += 1;
                    stats.opp_center += centre_bonus;
                }
            }

            // Stack control: who owns the top of a tall stack?
            if h >= 2 {
                let delta = (h - 1) * STACK_CONTROL_WEIGHT;
                if top.color == me {
                    stats.stack_score += delta;
                } else {
                    stats.stack_score -= delta;
                }
            }
        }
    }

    stats
}

// ---------------------------------------------------------------------------
// Public evaluation entry point
// ---------------------------------------------------------------------------

pub fn evaluate(state: &GameState) -> i32 {
    let me = state.current_player;
    let opp = me.opponent();

    let BoardStats { my_road, opp_road, filled, my_center, opp_center, stack_score } =
        board_stats(&state.board, state.size, me);

    // 1. Road-piece count advantage
    let piece_score = (my_road - opp_road) * PIECE_WEIGHT;

    // 2. Road connectivity / progress (BFS, unchanged)
    let my_progress = road_progress(&state.board, state.size, me);
    let opp_progress = road_progress(&state.board, state.size, opp);
    let road_score = (my_progress - opp_progress) * ROAD_PROGRESS_WEIGHT;

    // 3. Threat urgency: opponent is one step from completing a road
    //    (progress == size-1 would be a completed road, already terminal;
    //     size-2 is the furthest non-terminal reach, i.e. one step away)
    let threat_score = if opp_progress >= state.size as i32 - 2 { -THREAT_PENALTY } else { 0 };

    // 4. Flat endgame weighting: flat advantage scaled by board-fill ratio
    let total_cells = (state.size * state.size) as i32;
    let flat_score = (my_road - opp_road) * FLAT_ENDGAME_WEIGHT * filled / total_cells;

    // 5. Center control
    let center_score = (my_center - opp_center) * CENTER_WEIGHT;

    piece_score + road_score + threat_score + flat_score + center_score + stack_score
}

// ---------------------------------------------------------------------------
// Road progress (BFS)
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
