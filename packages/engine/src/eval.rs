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
/// For each axis (N-S and E-W) we run a BFS from **both** edges and take the
/// maximum depth reached.  Seeding from both ends is critical for correctness:
/// a chain built from the south (e.g. white pieces at c1+c2 on a 3×3) gets
/// zero credit from a north-only seed even though it is one step from winning.
///
/// A completed road scores `size - 1`.  We return the maximum of the two axes.
fn road_progress(board: &[Vec<Vec<Piece>>], size: usize, color: Color) -> i32 {
    let ns = furthest_reach(board, size, color, true, false)
        .max(furthest_reach(board, size, color, true, true));
    let ew = furthest_reach(board, size, color, false, false)
        .max(furthest_reach(board, size, color, false, true));
    ns.max(ew)
}

/// BFS from one edge of the board and return the farthest row/column the
/// connected component of `color` reaches toward the opposite edge.
///
/// `north_south = true` → N-S axis; `false` → E-W axis.
/// `reverse = false`    → seed from the near edge (row 0 / col 0).
/// `reverse = true`     → seed from the far edge (row size-1 / col size-1)
///                        and normalize progress so "reaching the near edge"
///                        still scores `size - 1`.
fn furthest_reach(
    board: &[Vec<Vec<Piece>>],
    size: usize,
    color: Color,
    north_south: bool,
    reverse: bool,
) -> i32 {
    let is_road = |r: usize, c: usize| -> bool {
        board[r][c]
            .last()
            .map_or(false, |p| p.color == color && p.typ != PieceType::Wall)
    };

    let mut visited = vec![false; size * size];
    let mut queue: VecDeque<(usize, usize)> = VecDeque::new();
    let mut best = 0i32;

    // Seed from the near edge, or the far edge when reversed.
    let edge = if reverse { size - 1 } else { 0 };
    for i in 0..size {
        let (r, c) = if north_south { (edge, i) } else { (i, edge) };
        if is_road(r, c) && !visited[r * size + c] {
            visited[r * size + c] = true;
            queue.push_back((r, c));
        }
    }

    while let Some((r, c)) = queue.pop_front() {
        let raw = if north_south { r } else { c } as i32;
        // Normalize: progress is distance from the seeding edge toward the far
        // edge.  Forward: the raw index grows away from edge 0.  Reversed: we
        // subtract from (size-1) so that reaching the near edge still = size-1.
        let progress = if reverse { (size as i32 - 1) - raw } else { raw };
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

    /// Bidirectional road_progress: a chain built from the far edge must score
    /// the same as an equivalent chain built from the near edge.
    ///
    /// Concretely: White pieces at c1+c2 on a 3×3 (rows 1–2 in col 2) form an
    /// NS chain that seeds from the *south*.  Without the bidirectional fix the
    /// north-only BFS gives them zero progress; with the fix they score 1
    /// (one step from the north edge).  This mirrors a symmetrical chain at
    /// rows 0–1 which the forward BFS correctly credits with progress 1.
    #[test]
    fn road_progress_bidirectional_far_edge_chain() {
        // White chain at rows 1–2, col 2 on a 3×3 (builds from south edge).
        let mut board_south = empty_board(3);
        board_south[1][2] = vec![flat(Color::White)]; // row 1 = c2
        board_south[2][2] = vec![flat(Color::White)]; // row 2 = c1

        // Equivalent chain at rows 0–1, col 2 (builds from north edge).
        let mut board_north = empty_board(3);
        board_north[0][2] = vec![flat(Color::White)]; // row 0 = c3
        board_north[1][2] = vec![flat(Color::White)]; // row 1 = c2

        // super:: prefix required for the private road_progress function.
        let prog_south = super::road_progress(&board_south, 3, Color::White);
        let prog_north = super::road_progress(&board_north, 3, Color::White);
        assert_eq!(
            prog_south, prog_north,
            "chain from south (prog={prog_south}) must equal chain from north (prog={prog_north})"
        );
        assert!(prog_south > 0, "a 2-piece chain must have non-zero road progress");
    }

    /// Regression: PTN sequence `1a3 2c1 3c2 4c3 5b3` leaves Black to move
    /// on a 3×3 board.  The move `c3<` (slide c3 west, capturing b3) is
    /// immediately losing — it empties c3 and lets White win with `c3`.
    /// The alternative `a3>` (slide a3 east, same capture target) leaves c3
    /// blocked by Black's own flat, preventing White's road.
    ///
    /// With the bidirectional fix White's c-column (c1+c2→c3) now gets NS
    /// road-progress credit from the south, so the raw depth-1 eval no longer
    /// incorrectly awards `c3<` a massive bonus over `a3>`.
    #[test]
    fn c3_slide_west_no_larger_eval_than_a3_slide_east() {
        // Board after 1a3 2c1 3c2 4c3 5b3 on a 3×3:
        //   row0 (rank 3): a3=[Black], b3=[White], c3=[Black]
        //   row1 (rank 2): c2=[White]
        //   row2 (rank 1): c1=[White]
        // current_player = Black (about to make move 6).
        let make_board = |a3: Color, b3: Color, c3_col: Option<Color>| {
            let mut b: Vec<Vec<Vec<Piece>>> = vec![vec![vec![]; 3]; 3];
            b[0][0] = vec![flat(a3)];      // a3
            b[0][1] = vec![flat(b3)];      // b3
            if let Some(c) = c3_col { b[0][2] = vec![flat(c)]; } // c3
            b[1][2] = vec![flat(Color::White)]; // c2
            b[2][2] = vec![flat(Color::White)]; // c1
            b
        };

        let base_state = GameState {
            board: make_board(Color::Black, Color::White, Some(Color::Black)),
            size: 3,
            current_player: Color::Black,
            players: Players {
                white: PlayerState { flat_count: 7, capstone_count: 0 },
                black: PlayerState { flat_count: 8, capstone_count: 0 },
            },
            turn_number: 6,
            result: None,
        };

        // After c3< (Black slides c3 west onto b3):
        //   b3 becomes [White,Black], c3 empty.
        let mut after_c3_left = base_state.clone();
        after_c3_left.board[0][2].clear();              // c3 emptied
        after_c3_left.board[0][1] = vec![flat(Color::White), flat(Color::Black)]; // b3=[W,B]
        after_c3_left.current_player = Color::White;    // it's White's turn

        // After a3> (Black slides a3 east onto b3):
        //   b3 becomes [White,Black], a3 empty; c3 still blocked by Black.
        let mut after_a3_right = base_state.clone();
        after_a3_right.board[0][0].clear();             // a3 emptied
        after_a3_right.board[0][1] = vec![flat(Color::White), flat(Color::Black)]; // b3=[W,B]
        after_a3_right.current_player = Color::White;

        // evaluate() returns score from White's perspective (current_player).
        let eval_c3_left  = evaluate(&after_c3_left);
        let eval_a3_right = evaluate(&after_a3_right);

        // After c3< White can place c3 and win immediately — White's true
        // position is SCORE_WIN.  The static heuristic cannot see one move
        // ahead, but with the bidirectional road-progress fix White at least
        // gets NS credit for its c1+c2 chain, equalising the two evals.
        //
        // Without the fix the north-only BFS sees White's c-column progress as 0
        // while the false threat penalty gives Black +400, so eval(c3<)=-480
        // versus eval(a3>)=-20: White looks dramatically worse in the position
        // where it actually wins next move, inverting the ordering.
        //
        // Assert: eval(after c3<) must be ≥ eval(after a3>).
        // Pre-fix: -480 ≥ -20 → FAIL  (bug detected)
        // Post-fix: -420 ≥ -420 → PASS (evals equalise; depth-2 resolves correctly)
        assert!(
            eval_c3_left >= eval_a3_right,
            "White's static eval after c3< ({eval_c3_left}) should be ≥ after a3> \
             ({eval_a3_right}): c3< lets White win immediately so it must not look \
             worse than a3> in the heuristic"
        );
    }
}
