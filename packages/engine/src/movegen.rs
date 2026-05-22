/// movegen.rs — enumerate ALL legal moves for the current player.
///
/// ## Slide completeness
///
/// For each own stack S at (row, col), each direction D, and each pickup count
/// C (1 ≤ C ≤ min(stack_height, board_size)), we generate every ordered
/// composition of C pieces across every reachable path length L
/// (1 ≤ L ≤ min(C, reachable_cells)).
///
/// A composition of C into L parts means any sequence [d₁, …, d_L] with
/// dᵢ ≥ 1 and Σdᵢ = C.  The number of such compositions is C(C-1, L-1),
/// so for C = 5, L = 5 there are 2⁴ = 16 distributions; for C = 8, L = 8
/// there are 128.  The total branching factor is higher than the old
/// canonical approach but gives the search every tactical option — front-
/// heavy drops (which build tall stacks and threaten road captures) are
/// now fully considered.
///
/// ## Wall-flattening constraint
///
/// If the last reachable cell has a wall, the FINAL drop must be exactly 1
/// piece AND that piece must be the capstone (= top of the original stack).
/// We enforce this by:
///   • requiring `top_is_cap` for any distribution that lands on the wall
///   • fixing `drops[L-1] = 1` and enumerating all compositions of C-1
///     into L-1 parts for the prefix cells

use crate::types::*;

pub fn gen_moves(state: &GameState) -> Vec<Move> {
    let mut moves = Vec::with_capacity(256);
    let size = state.size;
    let cp = state.current_player;
    let swap = state.turn_number <= 2;

    for row in 0..size {
        for col in 0..size {
            let stack = &state.board[row][col];

            if stack.is_empty() {
                // ----------------------------------------------------------------
                // Placements
                // ----------------------------------------------------------------
                if swap {
                    // Swap turns: only flat placements, piece colour handled in apply.
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
                // ----------------------------------------------------------------
                // Slides — only on own stacks, not on swap turns
                // ----------------------------------------------------------------
                let top = *stack.last().unwrap();
                if top.color != cp {
                    continue;
                }
                let top_is_cap = top.typ == PieceType::Capstone;
                let max_pickup = (size as u32).min(stack.len() as u32);

                for dir in Direction::ALL {
                    let path = reachable_path(&state.board, size, row, col, dir);
                    if path.is_empty() {
                        continue;
                    }

                    for count in 1..=max_pickup {
                        // Maximum path length for this count: can't travel more
                        // cells than pieces picked up (each cell needs ≥ 1 piece).
                        let max_path_len = (count as usize).min(path.len());

                        for path_len in 1..=max_path_len {
                            let last_has_wall = path[path_len - 1].has_wall;

                            if last_has_wall {
                                // Wall-flattening: needs a lone capstone as the last drop.
                                if !top_is_cap {
                                    // No capstone on top → can never flatten a wall.
                                    // All remaining path_len values also end on the same
                                    // wall (since it's the last entry in `path`), so we
                                    // can break the path_len loop here.
                                    break;
                                }
                                // Fix drops[path_len-1] = 1 (the capstone).
                                // Distribute the remaining (count-1) pieces freely in
                                // (path_len-1) prefix cells.
                                if path_len == 1 {
                                    // Lone capstone directly onto the wall.
                                    // Only valid when count == 1 (nothing else to place).
                                    if count == 1 {
                                        moves.push(Move::Slide {
                                            row, col, direction: dir, drops: vec![1],
                                        });
                                    }
                                    // count > 1 with path_len 1: would need to drop
                                    // (count-1) pieces somewhere with no prefix cells.
                                } else {
                                    // Enumerate all compositions of (count-1) into
                                    // (path_len-1) parts, then append the fixed 1.
                                    let prefix_n = count - 1;
                                    let prefix_k = path_len - 1;
                                    let mut buf = Vec::with_capacity(path_len);
                                    compose(prefix_n, prefix_k, &mut buf, &mut |prefix| {
                                        let mut drops = prefix.to_vec();
                                        drops.push(1);
                                        moves.push(Move::Slide {
                                            row, col, direction: dir, drops,
                                        });
                                    });
                                }
                            } else {
                                // Normal cell: all compositions of count into path_len parts.
                                let mut buf = Vec::with_capacity(path_len);
                                compose(count, path_len, &mut buf, &mut |drops| {
                                    moves.push(Move::Slide {
                                        row, col, direction: dir, drops: drops.to_vec(),
                                    });
                                });
                            }
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

struct PathCell {
    has_wall: bool,
}

/// Cells reachable from (row, col) in `dir`:
///   • stops before a capstone (exclusive — cannot land there)
///   • stops at a wall (inclusive — can land there with the right piece, but
///     cannot pass through), marking that entry `has_wall = true`
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
        match board[r as usize][c as usize].last().map(|p| p.typ) {
            Some(PieceType::Capstone) => break,
            Some(PieceType::Wall) => {
                path.push(PathCell { has_wall: true });
                break;
            }
            _ => path.push(PathCell { has_wall: false }),
        }
        r += dr;
        c += dc;
    }

    path
}

// ---------------------------------------------------------------------------
// Composition enumeration
// ---------------------------------------------------------------------------

/// Enumerate every ordered composition of `n` into exactly `k` positive
/// parts (each part ≥ 1, parts sum to n).
///
/// Calls `callback` once per composition with a shared slice backed by `buf`.
/// `buf` is used as a reusable stack to avoid per-composition allocations.
///
/// Empty result when n < k (impossible to give each part ≥ 1).
pub fn compose(n: u32, k: usize, buf: &mut Vec<u32>, callback: &mut impl FnMut(&[u32])) {
    if k == 0 {
        if n == 0 {
            callback(buf);
        }
        return;
    }
    // Guard: impossible to give each of k slots at least 1 piece.
    if n < k as u32 {
        return;
    }
    if k == 1 {
        buf.push(n);
        callback(buf);
        buf.pop();
        return;
    }
    // Place i pieces in the current slot (1 ≤ i ≤ n - (k-1)).
    let max_here = n - (k as u32 - 1);
    for i in 1..=max_here {
        buf.push(i);
        compose(n - i, k - 1, buf, callback);
        buf.pop();
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn all_compositions(n: u32, k: usize) -> Vec<Vec<u32>> {
        let mut results = Vec::new();
        let mut buf = Vec::new();
        compose(n, k, &mut buf, &mut |s| results.push(s.to_vec()));
        results
    }

    // compose(n, k) should produce C(n-1, k-1) compositions.
    fn binom(n: usize, k: usize) -> usize {
        if k > n { return 0; }
        let k = k.min(n - k);
        (0..k).fold(1usize, |acc, i| acc * (n - i) / (i + 1))
    }

    #[test]
    fn compose_counts_match_binomial() {
        for n in 1u32..=8 {
            for k in 1..=(n as usize) {
                let got = all_compositions(n, k).len();
                let expected = binom((n - 1) as usize, k - 1);
                assert_eq!(got, expected, "compose({n},{k}): got {got}, expected {expected}");
            }
        }
    }

    #[test]
    fn compose_all_parts_positive_and_sum_correct() {
        for n in 1u32..=6 {
            for k in 1..=(n as usize) {
                for comp in all_compositions(n, k) {
                    assert_eq!(comp.len(), k, "length wrong for compose({n},{k})");
                    assert_eq!(comp.iter().sum::<u32>(), n, "sum wrong for compose({n},{k})");
                    assert!(comp.iter().all(|&x| x >= 1), "zero part in compose({n},{k})");
                }
            }
        }
    }

    #[test]
    fn compose_3_into_2_is_two_one_and_one_two() {
        let mut got = all_compositions(3, 2);
        got.sort();
        assert_eq!(got, vec![vec![1, 2], vec![2, 1]]);
    }

    #[test]
    fn compose_4_into_2_has_three_compositions() {
        // [1,3], [2,2], [3,1]
        let mut got = all_compositions(4, 2);
        got.sort();
        assert_eq!(got, vec![vec![1, 3], vec![2, 2], vec![3, 1]]);
    }

    #[test]
    fn compose_impossible_returns_empty() {
        // Can't split 2 into 3 positive parts.
        assert!(all_compositions(2, 3).is_empty());
        assert!(all_compositions(0, 1).is_empty());
    }

    // ------------------------------------------------------------------
    // Slide move count: on an empty 5×5 board with a single 3-stack,
    // how many slide moves should gen_moves produce in one direction?
    //
    // Path length (south from row 0): 4 cells (rows 1–4).
    // For count c ∈ {1,2,3} and path_len l ∈ {1..min(c,4)}:
    //   count=1: l=1 → compose(1,1)=1 → 1 move
    //   count=2: l=1 → [2] (1), l=2 → [1,1] (1) → 2 moves
    //   count=3: l=1 → [3] (1), l=2 → [1,2],[2,1] (2), l=3 → [1,1,1] (1) → 4 moves
    // Total south: 7 moves.  Same for north (3 cells from row 0 = rows above... wait,
    // the stack is AT row 0 so going north has 0 cells: 0 slide moves north.
    //
    // Let's just check the total slide-move count in all 4 directions.
    #[test]
    fn slide_move_count_3stack_corner() {
        use crate::types::*;
        // 3-stack of white flats at top-left corner (0,0) on a 5×5 board.
        let mut board: Vec<Vec<Vec<Piece>>> = (0..5)
            .map(|_| (0..5).map(|_| vec![]).collect())
            .collect();
        board[0][0] = vec![
            Piece { typ: PieceType::Flat, color: Color::White },
            Piece { typ: PieceType::Flat, color: Color::White },
            Piece { typ: PieceType::Flat, color: Color::White },
        ];
        // Add one black piece so it's a post-swap turn.
        board[4][4] = vec![Piece { typ: PieceType::Flat, color: Color::Black }];

        let state = GameState {
            board,
            size: 5,
            current_player: Color::White,
            players: crate::types::Players {
                white: crate::types::PlayerState { flat_count: 18, capstone_count: 1 },
                black: crate::types::PlayerState { flat_count: 20, capstone_count: 1 },
            },
            turn_number: 3,
            result: None,
        };

        let moves = gen_moves(&state);
        let slide_moves: Vec<_> = moves.iter()
            .filter(|m| matches!(m, Move::Slide { .. }))
            .collect();

        // From (0,0) on a 5×5 board:
        // North (+): 0 cells (already at top edge) → 0 slides
        // West (<):  0 cells (already at left edge) → 0 slides
        // South (-): 4 cells open → count=1:1, count=2:2, count=3:4 → 7 slides
        // East (>):  4 cells open → same → 7 slides
        // Total: 14 slide moves.
        assert_eq!(slide_moves.len(), 14,
            "expected 14 slide moves from corner 3-stack, got {}",
            slide_moves.len());
    }
}
