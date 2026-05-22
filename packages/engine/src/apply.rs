/// apply.rs — apply a move to a GameState, detect wins, advance turn.
///
/// KEY DIFFERENCE from the TypeScript version: current_player is ALWAYS
/// advanced after a move, even when the game ends. This keeps negamax
/// clean: a terminal node's current_player is always the *loser* (for road
/// wins) or the non-triggering player (for flat wins), so the search can
/// always use `result.winner != current_player` as the loss condition.

use crate::types::*;
use std::collections::VecDeque;

pub fn apply_move(state: &GameState, mv: &Move) -> GameState {
    let mut next = match mv {
        Move::Place { piece_type, row, col } => apply_place(state, *piece_type, *row, *col),
        Move::Slide { row, col, direction, drops } => {
            apply_slide(state, *row, *col, *direction, drops)
        }
    };

    // Detect win before advancing turn (current_player is still the mover here).
    check_win(&mut next);

    // Always advance turn — makes negamax terminal handling uniform.
    next.current_player = next.current_player.opponent();
    next.turn_number += 1;

    next
}

// ---------------------------------------------------------------------------
// Place
// ---------------------------------------------------------------------------

fn apply_place(state: &GameState, piece_type: PieceType, row: usize, col: usize) -> GameState {
    let mut next = state.clone();

    // Swap turns (1 & 2): current player places the *opponent's* flat.
    let piece_color = if state.turn_number <= 2 {
        state.current_player.opponent()
    } else {
        state.current_player
    };

    next.board[row][col].push(Piece { typ: piece_type, color: piece_color });

    let owner = next.player_mut(piece_color);
    if piece_type == PieceType::Capstone {
        owner.capstone_count -= 1;
    } else {
        owner.flat_count -= 1;
    }

    next
}

// ---------------------------------------------------------------------------
// Slide
// ---------------------------------------------------------------------------

fn apply_slide(
    state: &GameState,
    row: usize,
    col: usize,
    direction: Direction,
    drops: &[u32],
) -> GameState {
    let mut next = state.clone();
    let count: u32 = drops.iter().sum();
    let (dr, dc) = direction.delta();

    let src = &mut next.board[row][col];
    let split_at = src.len() - count as usize;
    let hand: Vec<Piece> = src.drain(split_at..).collect();

    let mut r = row as i32 + dr;
    let mut c = col as i32 + dc;
    let mut offset = 0usize;

    for &drop in drops {
        let dest = &mut next.board[r as usize][c as usize];
        let dropping = &hand[offset..offset + drop as usize];

        // Capstone flattening a wall on the final step.
        if let Some(top) = dest.last_mut() {
            if top.typ == PieceType::Wall
                && drop == 1
                && dropping[0].typ == PieceType::Capstone
            {
                top.typ = PieceType::Flat;
            }
        }

        dest.extend_from_slice(dropping);
        offset += drop as usize;
        r += dr;
        c += dc;
    }

    next
}

// ---------------------------------------------------------------------------
// Win detection
// ---------------------------------------------------------------------------

fn check_win(state: &mut GameState) {
    // Road wins
    let white_road = has_road(&state.board, state.size, Color::White);
    let black_road = has_road(&state.board, state.size, Color::Black);

    if white_road || black_road {
        // Both complete simultaneously (possible after a slide): mover wins.
        let winner = if white_road && black_road {
            state.current_player
        } else if white_road {
            Color::White
        } else {
            Color::Black
        };
        state.result = Some(GameResult { winner, reason: "road".into() });
        return;
    }

    // Flat wins: board full or a player runs out of pieces.
    let board_full = is_full(&state.board, state.size);
    let white_out = is_out(&state.players.white);
    let black_out = is_out(&state.players.black);

    if board_full || white_out || black_out {
        let wf = count_flats(&state.board, state.size, Color::White);
        let bf = count_flats(&state.board, state.size, Color::Black);
        let winner = if wf == bf {
            // Tie in flats: the player who did NOT trigger the end wins.
            state.current_player.opponent()
        } else if wf > bf {
            Color::White
        } else {
            Color::Black
        };
        state.result = Some(GameResult { winner, reason: "flats".into() });
    }
}

// ---------------------------------------------------------------------------
// Road detection — BFS, mirrors TypeScript hasRoad()
// ---------------------------------------------------------------------------

fn has_road(board: &[Vec<Vec<Piece>>], size: usize, color: Color) -> bool {
    let is_road_cell = |r: usize, c: usize| -> bool {
        board[r][c]
            .last()
            .map_or(false, |p| p.color == color && p.typ != PieceType::Wall)
    };

    let bfs = |seeds: &[(usize, usize)], goal: &dyn Fn(usize, usize) -> bool| -> bool {
        let mut visited = vec![false; size * size];
        let mut queue: VecDeque<(usize, usize)> = VecDeque::new();
        for &(r, c) in seeds {
            if is_road_cell(r, c) && !visited[r * size + c] {
                visited[r * size + c] = true;
                queue.push_back((r, c));
            }
        }
        while let Some((r, c)) = queue.pop_front() {
            if goal(r, c) {
                return true;
            }
            for (nr, nc) in neighbours(r, c, size) {
                if !visited[nr * size + nc] && is_road_cell(nr, nc) {
                    visited[nr * size + nc] = true;
                    queue.push_back((nr, nc));
                }
            }
        }
        false
    };

    // N → S
    let top_seeds: Vec<(usize, usize)> = (0..size).map(|c| (0, c)).collect();
    let ns = bfs(&top_seeds, &|r, _| r == size - 1);

    // W → E
    let left_seeds: Vec<(usize, usize)> = (0..size).map(|r| (r, 0)).collect();
    let ew = bfs(&left_seeds, &|_, c| c == size - 1);

    ns || ew
}

#[inline]
fn neighbours(r: usize, c: usize, size: usize) -> Vec<(usize, usize)> {
    let mut v = Vec::with_capacity(4);
    if r > 0 { v.push((r - 1, c)); }
    if r + 1 < size { v.push((r + 1, c)); }
    if c > 0 { v.push((r, c - 1)); }
    if c + 1 < size { v.push((r, c + 1)); }
    v
}

fn count_flats(board: &[Vec<Vec<Piece>>], size: usize, color: Color) -> i32 {
    let mut n = 0;
    for r in 0..size {
        for c in 0..size {
            if let Some(p) = board[r][c].last() {
                if p.color == color && p.typ == PieceType::Flat {
                    n += 1;
                }
            }
        }
    }
    n
}

fn is_full(board: &[Vec<Vec<Piece>>], size: usize) -> bool {
    (0..size).all(|r| (0..size).all(|c| !board[r][c].is_empty()))
}

fn is_out(p: &PlayerState) -> bool {
    p.flat_count <= 0 && p.capstone_count <= 0
}
