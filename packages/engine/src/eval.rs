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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn flat(color: Color) -> Piece {
        Piece { typ: PieceType::Flat, color }
    }

    fn make_state(size: usize, board: Vec<Vec<Vec<Piece>>>) -> GameState {
        GameState {
            board,
            size,
            current_player: Color::White,
            players: Players {
                white: PlayerState { flat_count: 21, capstone_count: 1 },
                black: PlayerState { flat_count: 21, capstone_count: 1 },
            },
            turn_number: 3,
            result: None,
        }
    }

    fn empty_board(size: usize) -> Vec<Vec<Vec<Piece>>> {
        vec![vec![vec![]; size]; size]
    }

    /// Threat urgency: opponent one step from a road should score significantly
    /// worse for the current player than an unthreatening position.
    #[test]
    fn threat_penalty_fires_when_opponent_near_road() {
        // Black chain down col 0, rows 0–3 (progress = 3 = size−2 on a 5×5).
        let mut board = empty_board(5);
        for r in 0..4 {
            board[r][0] = vec![flat(Color::Black)];
        }
        let threatened = make_state(5, board);

        // Black chain down col 0, rows 0–1 only (progress = 1, not threatening).
        let mut board2 = empty_board(5);
        for r in 0..2 {
            board2[r][0] = vec![flat(Color::Black)];
        }
        let safe = make_state(5, board2);

        // The threatened position should be much worse for white, with the gap
        // at least as large as THREAT_PENALTY itself.
        let gap = evaluate(&safe) - evaluate(&threatened);
        assert!(gap >= THREAT_PENALTY, "gap {gap} should be >= THREAT_PENALTY {THREAT_PENALTY}");
    }

    /// Centre control: a road piece on the centre cell should outscore the same
    /// piece on a corner, all else being equal.
    #[test]
    fn centre_piece_scores_higher_than_corner() {
        let mut centre_board = empty_board(5);
        centre_board[2][2] = vec![flat(Color::White)]; // centre cell
        let centre_state = make_state(5, centre_board);

        let mut corner_board = empty_board(5);
        corner_board[0][0] = vec![flat(Color::White)]; // far corner
        let corner_state = make_state(5, corner_board);

        assert!(
            evaluate(&centre_state) > evaluate(&corner_state),
            "centre eval {} should beat corner eval {}",
            evaluate(&centre_state),
            evaluate(&corner_state),
        );
    }

    /// Stack control: owning the top of a tall stack should score better than
    /// the opponent owning it.
    #[test]
    fn owning_tall_stack_top_scores_higher() {
        // 3-high stack at (0,0) — white on top (favourable for white).
        let mut owned_board = empty_board(5);
        owned_board[0][0] = vec![flat(Color::Black), flat(Color::Black), flat(Color::White)];
        let owned = make_state(5, owned_board);

        // Same stack but black on top (unfavourable for white).
        let mut buried_board = empty_board(5);
        buried_board[0][0] = vec![flat(Color::White), flat(Color::White), flat(Color::Black)];
        let buried = make_state(5, buried_board);

        assert!(
            evaluate(&owned) > evaluate(&buried),
            "owning stack top ({}) should outscore being buried ({})",
            evaluate(&owned),
            evaluate(&buried),
        );
    }

    /// Flat endgame weighting: a flat-count advantage is worth more when the
    /// board is nearly full than when it is sparse.
    #[test]
    fn flat_advantage_weighted_more_on_full_board() {
        // Sparse: white up 1 flat, only 1 piece on the board.
        let mut sparse_board = empty_board(5);
        sparse_board[0][0] = vec![flat(Color::White)];
        let sparse = make_state(5, sparse_board);

        // Dense: 25 pieces, alternating white/black (white gets the extra one).
        // White: cells where (r*5+c) is even → 13 pieces.
        // Black: cells where (r*5+c) is odd  → 12 pieces.
        let mut dense_board = empty_board(5);
        for r in 0..5 {
            for c in 0..5 {
                let color = if (r * 5 + c) % 2 == 0 { Color::White } else { Color::Black };
                dense_board[r][c] = vec![flat(color)];
            }
        }
        let dense = make_state(5, dense_board);

        // Both positions give white a +1 flat advantage, but the dense board
        // should value it more due to the endgame weighting term.
        assert!(
            evaluate(&dense) > evaluate(&sparse),
            "full-board flat advantage ({}) should outscore sparse ({})",
            evaluate(&dense),
            evaluate(&sparse),
        );
    }
}
