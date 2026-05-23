/// search.rs — iterative-deepening negamax with alpha-beta pruning.
///
/// ## Design
///
/// * **Negamax** convention: every node returns the score from the perspective
///   of `state.current_player` (the player about to move).  The caller negates
///   the result.
///
/// * **Terminal detection**: `apply_move` always advances `current_player`, so
///   a node with `result.is_some()` has `current_player` = the player who did
///   NOT make the winning move, i.e. the *loser*.  We return `−SCORE_WIN`
///   (they lost) and the caller negates to `+SCORE_WIN` for the mover.
///   Exception: when the *winner* has fewer flats (flat-win where triggerer
///   loses) — `check_win` sets `result.winner` correctly regardless, so we
///   compare `result.winner` against `current_player` for the correct sign.
///
/// * **Move ordering** at every level: winning moves evaluated first by doing a
///   shallow apply before sorting.  This dramatically improves cut-off rates.
///
/// * **Transposition table**: Zobrist-hashed positions are stored in a 1 M
///   entry fixed-size table (see `tt.rs`).  A TT hit can return early with an
///   exact score or tighten the alpha/beta window, cutting off the subtree.
///   The table persists across calls so positions from earlier turns are reused.
///
/// * **Time budget**: `js_sys::Date::now()` is checked after every root child
///   and every `NODE_CHECK_INTERVAL` interior nodes.  When the deadline passes
///   the search unwinds and returns the best move found so far.
///
/// * **Iterative deepening**: depth 1 → … → MAX_DEPTH, stopping when the
///   deadline is hit or a forced win/loss is detected.

use crate::{apply::apply_move, eval::*, movegen::gen_moves, tt::{hash_state, TtFlag, TT, ZOBRIST}, types::*};

const MAX_DEPTH: u32 = 12;
const NODE_CHECK_INTERVAL: u32 = 256;

pub fn find_best_move(state: &GameState, time_budget_ms: f64) -> Move {
    let deadline = js_sys::Date::now() + time_budget_ms;

    let mut moves = gen_moves(state);
    assert!(!moves.is_empty(), "find_best_move called on a terminal position");

    // Seed: pick first move so we always have a fallback.
    let mut best_move = moves[0].clone();

    for depth in 1..=MAX_DEPTH {
        if js_sys::Date::now() >= deadline {
            break;
        }

        let mut counter = 0u32;
        let result = search_root(state, &moves, depth, deadline, &mut counter);

        match result {
            SearchResult::Completed { mv, score } => {
                best_move = mv.clone();
                // Re-order moves so the best move from this iteration is tried
                // first in the next, improving pruning (poor-man's TT).
                if let Some(pos) = moves.iter().position(|m| move_eq(m, &mv)) {
                    moves.swap(0, pos);
                }
                // Proven win — no need to go deeper.
                if score >= SCORE_WIN / 2 {
                    break;
                }
            }
            SearchResult::Timeout { mv: Some(mv) } => {
                // Partial result: only update if we have something.
                best_move = mv;
                break;
            }
            SearchResult::Timeout { mv: None } => {
                // Didn't finish even one root child — keep previous best.
                break;
            }
        }
    }

    best_move
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

enum SearchResult {
    Completed { mv: Move, score: i32 },
    Timeout { mv: Option<Move> },
}

// ---------------------------------------------------------------------------
// Root search — tracks best move separately so partial results are usable.
// ---------------------------------------------------------------------------

fn search_root(
    state: &GameState,
    moves: &[Move],
    depth: u32,
    deadline: f64,
    counter: &mut u32,
) -> SearchResult {
    let mut alpha = -(SCORE_WIN + 1);
    let beta = SCORE_WIN + 1;
    let mut best_move: Option<Move> = None;

    // Pre-score root moves for ordering: apply each and get a quick eval.
    let mut scored: Vec<(i32, &Move)> = moves
        .iter()
        .map(|mv| {
            let next = apply_move(state, mv);
            let s = if let Some(ref r) = next.result {
                // Terminal: winning for us, losing, or draw?
                // apply always advances turn, so compare winner vs. our colour.
                match r.winner {
                    Some(w) if w == state.current_player => SCORE_WIN,
                    None => 0, // draw
                    _ => -SCORE_WIN,
                }
            } else {
                -evaluate(&next) // negate: eval from next.current_player = opponent
            };
            (s, mv)
        })
        .collect();
    scored.sort_unstable_by(|a, b| b.0.cmp(&a.0));

    for (_, mv) in &scored {
        if js_sys::Date::now() >= deadline {
            return SearchResult::Timeout { mv: best_move };
        }

        let next = apply_move(state, mv);
        let score = -negamax(&next, depth - 1, -beta, -alpha, deadline, counter);

        if score > alpha {
            alpha = score;
            best_move = Some((*mv).clone());
        }
    }

    match best_move {
        Some(mv) => SearchResult::Completed { mv, score: alpha },
        None => SearchResult::Timeout { mv: None },
    }
}

// ---------------------------------------------------------------------------
// Recursive negamax
// ---------------------------------------------------------------------------

fn negamax(
    state: &GameState,
    depth: u32,
    mut alpha: i32,
    beta: i32,
    deadline: f64,
    counter: &mut u32,
) -> i32 {
    // Terminal position check.
    if let Some(result) = &state.result {
        return match result.winner {
            Some(w) if w == state.current_player => SCORE_WIN,
            None => 0, // draw — neutral for both sides
            _ => -SCORE_WIN,
        };
    }

    // Depth limit: return static eval.
    if depth == 0 {
        return evaluate(state);
    }

    // Periodic time check.
    *counter += 1;
    if *counter % NODE_CHECK_INTERVAL == 0 && js_sys::Date::now() >= deadline {
        return evaluate(state);
    }

    // Transposition table probe — may return early or tighten the window.
    let hash = ZOBRIST.with(|z| hash_state(state, z));
    let original_alpha = alpha;
    if let Some(tt_score) = TT.with(|tt| tt.borrow().probe(hash, depth, alpha, beta)) {
        return tt_score;
    }

    let moves = gen_moves(state);
    if moves.is_empty() {
        return evaluate(state);
    }

    // Move ordering: sort by quick child eval (shallow, no recursion).
    let mut scored: Vec<(i32, Move)> = moves
        .into_iter()
        .map(|mv| {
            let next = apply_move(state, &mv);
            let s = if let Some(ref r) = next.result {
                match r.winner {
                    Some(w) if w == state.current_player => SCORE_WIN,
                    None => 0,
                    _ => -SCORE_WIN,
                }
            } else {
                -evaluate(&next)
            };
            (s, mv)
        })
        .collect();
    scored.sort_unstable_by(|a, b| b.0.cmp(&a.0));

    for (prescore, mv) in scored {
        // If this move is already known to be a forced win, take it immediately.
        if prescore >= SCORE_WIN / 2 {
            TT.with(|tt| tt.borrow_mut().store(hash, depth, SCORE_WIN, TtFlag::Exact));
            return SCORE_WIN;
        }

        let next = apply_move(state, &mv);
        let score = -negamax(&next, depth - 1, -beta, -alpha, deadline, counter);

        if score > alpha {
            alpha = score;
        }
        if alpha >= beta {
            break; // Beta cut-off
        }
    }

    // Store the result in the transposition table.
    let flag = if alpha <= original_alpha {
        TtFlag::UpperBound // all moves failed low — score is an upper bound
    } else if alpha >= beta {
        TtFlag::LowerBound // caused a cut-off — score is a lower bound
    } else {
        TtFlag::Exact // alpha improved within window — score is exact
    };
    TT.with(|tt| tt.borrow_mut().store(hash, depth, alpha, flag));

    alpha
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn move_eq(a: &Move, b: &Move) -> bool {
    match (a, b) {
        (
            Move::Place { piece_type: pt1, row: r1, col: c1 },
            Move::Place { piece_type: pt2, row: r2, col: c2 },
        ) => pt1 == pt2 && r1 == r2 && c1 == c2,
        (
            Move::Slide { row: r1, col: c1, direction: d1, drops: dr1 },
            Move::Slide { row: r2, col: c2, direction: d2, drops: dr2 },
        ) => r1 == r2 && c1 == c2 && d1 == d2 && dr1 == dr2,
        _ => false,
    }
}
