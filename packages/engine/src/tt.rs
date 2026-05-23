/// tt.rs — Zobrist hashing and transposition table.
///
/// ## Zobrist hashing
///
/// A random `u64` is assigned to every (row, col, depth-in-stack, piece-type,
/// color) combination at initialisation.  The board hash is the XOR of all
/// keys for every piece currently on the board, plus a side-to-move key when
/// it is Black's turn.  XOR makes the hash easy to compute from scratch.
///
/// ## Transposition table
///
/// A fixed-size, directly-addressed table (power-of-two entries, indexed by
/// `hash & (SIZE - 1)`).  Each entry stores the full hash so collisions can
/// be detected.  Replacement policy: depth-preferred — overwrite only when
/// the slot is empty, holds a different position (collision), or the new
/// result was searched at least as deeply.
///
/// The table persists across `find_best_move` calls via `thread_local!`,
/// giving inter-move benefit when the same position recurs.

use std::cell::RefCell;

use crate::types::*;

// ---------------------------------------------------------------------------
// Zobrist keys
// ---------------------------------------------------------------------------

/// Board dimensions for table sizing — covers up to 8×8.
const MAX_BOARD: usize = 8;
/// Maximum stack depth tracked; deeper stacks are clamped to this index.
const MAX_STACK: usize = 64;

fn xorshift64(x: &mut u64) -> u64 {
    *x ^= *x << 13;
    *x ^= *x >> 7;
    *x ^= *x << 17;
    *x
}

pub struct ZobristKeys {
    // Flattened [row][col][depth][piece_type][color] → 6 variants per slot.
    data: Vec<u64>,
    pub side_to_move: u64,
}

impl ZobristKeys {
    #[inline]
    fn idx(r: usize, c: usize, d: usize, pt: usize, col: usize) -> usize {
        ((r * MAX_BOARD + c) * MAX_STACK + d) * 6 + pt * 2 + col
    }

    pub fn generate() -> Self {
        let mut seed = 0x4d595df4d0f33173_u64; // deterministic seed
        let total = MAX_BOARD * MAX_BOARD * MAX_STACK * 3 * 2;
        let mut data = vec![0u64; total];
        for v in &mut data {
            *v = xorshift64(&mut seed);
        }
        let side_to_move = xorshift64(&mut seed);
        Self { data, side_to_move }
    }

    #[inline]
    pub fn piece_key(&self, r: usize, c: usize, depth: usize, typ: PieceType, color: Color) -> u64 {
        let d = depth.min(MAX_STACK - 1);
        let pt = match typ {
            PieceType::Flat => 0,
            PieceType::Wall => 1,
            PieceType::Capstone => 2,
        };
        let col = match color {
            Color::White => 0,
            Color::Black => 1,
        };
        self.data[Self::idx(r, c, d, pt, col)]
    }
}

/// Compute a Zobrist hash for `state` from scratch.
pub fn hash_state(state: &GameState, keys: &ZobristKeys) -> u64 {
    let mut h = 0u64;
    for r in 0..state.size {
        for c in 0..state.size {
            for (d, p) in state.board[r][c].iter().enumerate() {
                h ^= keys.piece_key(r, c, d, p.typ, p.color);
            }
        }
    }
    if state.current_player == Color::Black {
        h ^= keys.side_to_move;
    }
    h
}

// ---------------------------------------------------------------------------
// Transposition table
// ---------------------------------------------------------------------------

/// 1 M entries — each entry is 16 bytes → ~16 MB total.
const TT_SIZE: usize = 1 << 20;

#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum TtFlag {
    /// Score is exact.
    Exact = 0,
    /// Score is a lower bound (caused a beta cut-off).
    LowerBound = 1,
    /// Score is an upper bound (all moves failed low).
    UpperBound = 2,
}

/// A single transposition-table entry (16 bytes, Copy).
#[derive(Clone, Copy)]
pub struct TtEntry {
    /// Full Zobrist hash — used for collision detection. `0` = empty slot.
    hash: u64,
    score: i32,
    depth: u8,
    flag: TtFlag,
    // 2 bytes implicit padding to reach 16 bytes
}

impl Default for TtEntry {
    fn default() -> Self {
        Self { hash: 0, score: 0, depth: 0, flag: TtFlag::Exact }
    }
}

pub struct TranspositionTable {
    table: Vec<TtEntry>,
}

impl TranspositionTable {
    pub fn new() -> Self {
        Self { table: vec![TtEntry::default(); TT_SIZE] }
    }

    /// Return a usable score if the table holds a sufficiently deep result
    /// for `hash` that allows a cutoff at the current `alpha`/`beta` window.
    pub fn probe(&self, hash: u64, depth: u32, alpha: i32, beta: i32) -> Option<i32> {
        let entry = self.table[hash as usize & (TT_SIZE - 1)];
        if entry.hash != hash {
            return None; // empty or different position
        }
        if (entry.depth as u32) < depth {
            return None; // stored result from a shallower search
        }
        match entry.flag {
            TtFlag::Exact => Some(entry.score),
            TtFlag::LowerBound => {
                if entry.score >= beta { Some(entry.score) } else { None }
            }
            TtFlag::UpperBound => {
                if entry.score <= alpha { Some(entry.score) } else { None }
            }
        }
    }

    /// Store a search result, using depth-preferred replacement.
    pub fn store(&mut self, hash: u64, depth: u32, score: i32, flag: TtFlag) {
        let idx = hash as usize & (TT_SIZE - 1);
        let existing = self.table[idx];
        // Overwrite if: slot is empty, different position (hash collision),
        // or the new search went at least as deep.
        if existing.hash == 0 || existing.hash != hash || existing.depth <= depth as u8 {
            self.table[idx] = TtEntry { hash, score, depth: depth as u8, flag };
        }
    }
}

// Thread-local singletons — one Zobrist table and one TT per wasm instance.
thread_local! {
    pub static ZOBRIST: ZobristKeys = ZobristKeys::generate();
    pub static TT: RefCell<TranspositionTable> = RefCell::new(TranspositionTable::new());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_state(size: usize) -> GameState {
        GameState {
            board: vec![vec![vec![]; size]; size],
            size,
            current_player: Color::White,
            players: Players {
                white: PlayerState { flat_count: 21, capstone_count: 1 },
                black: PlayerState { flat_count: 21, capstone_count: 1 },
            },
            turn_number: 1,
            result: None,
        }
    }

    fn flat(color: Color) -> Piece {
        Piece { typ: PieceType::Flat, color }
    }

    // --- Zobrist hash tests ---

    #[test]
    fn same_state_produces_same_hash() {
        let keys = ZobristKeys::generate();
        let state = make_state(5);
        assert_eq!(hash_state(&state, &keys), hash_state(&state, &keys));
    }

    #[test]
    fn different_piece_position_different_hash() {
        let keys = ZobristKeys::generate();
        let mut s1 = make_state(5);
        s1.board[0][0] = vec![flat(Color::White)];
        let mut s2 = make_state(5);
        s2.board[1][1] = vec![flat(Color::White)];
        assert_ne!(hash_state(&s1, &keys), hash_state(&s2, &keys));
    }

    #[test]
    fn side_to_move_changes_hash() {
        let keys = ZobristKeys::generate();
        let mut state = make_state(5);
        state.board[2][2] = vec![flat(Color::White)];
        let mut black_to_move = state.clone();
        black_to_move.current_player = Color::Black;
        assert_ne!(hash_state(&state, &keys), hash_state(&black_to_move, &keys));
    }

    #[test]
    fn piece_color_changes_hash() {
        let keys = ZobristKeys::generate();
        let mut white_piece = make_state(5);
        white_piece.board[0][0] = vec![flat(Color::White)];
        let mut black_piece = make_state(5);
        black_piece.board[0][0] = vec![flat(Color::Black)];
        assert_ne!(hash_state(&white_piece, &keys), hash_state(&black_piece, &keys));
    }

    // --- Transposition table tests ---

    #[test]
    fn tt_exact_hit_at_same_depth() {
        let mut tt = TranspositionTable::new();
        let hash = 0xdeadbeef_cafebabe_u64;
        tt.store(hash, 4, 42, TtFlag::Exact);
        assert_eq!(tt.probe(hash, 4, -1000, 1000), Some(42));
    }

    #[test]
    fn tt_exact_hit_at_shallower_request() {
        let mut tt = TranspositionTable::new();
        let hash = 0xdeadbeef_cafebabe_u64;
        tt.store(hash, 4, 42, TtFlag::Exact);
        // Stored at depth 4, requesting at depth 2 — deeper entry is usable.
        assert_eq!(tt.probe(hash, 2, -1000, 1000), Some(42));
    }

    #[test]
    fn tt_miss_on_insufficient_depth() {
        let mut tt = TranspositionTable::new();
        let hash = 0xdeadbeef_cafebabe_u64;
        tt.store(hash, 2, 42, TtFlag::Exact);
        // Stored at depth 2, requesting at depth 3 — must miss.
        assert_eq!(tt.probe(hash, 3, -1000, 1000), None);
    }

    #[test]
    fn tt_lower_bound_cutoff() {
        let mut tt = TranspositionTable::new();
        let hash = 0xdeadbeef_cafebabe_u64;
        tt.store(hash, 4, 500, TtFlag::LowerBound);
        // score(500) >= beta(400) → can cut off
        assert_eq!(tt.probe(hash, 4, 0, 400), Some(500));
        // score(500) < beta(600) → cannot cut off
        assert_eq!(tt.probe(hash, 4, 0, 600), None);
    }

    #[test]
    fn tt_upper_bound_cutoff() {
        let mut tt = TranspositionTable::new();
        let hash = 0xdeadbeef_cafebabe_u64;
        tt.store(hash, 4, -500, TtFlag::UpperBound);
        // score(-500) <= alpha(-400) → true score ≤ -500 ≤ alpha, node fails low → return it
        assert_eq!(tt.probe(hash, 4, -400, 0), Some(-500));
        // score(-500) > alpha(-600) → true score could still exceed alpha → cannot cut off
        assert_eq!(tt.probe(hash, 4, -600, 0), None);
    }

    #[test]
    fn tt_depth_preferred_replacement() {
        let mut tt = TranspositionTable::new();
        let hash = 0xdeadbeef_cafebabe_u64;
        tt.store(hash, 4, 100, TtFlag::Exact);
        // Shallower entry should NOT overwrite the deeper one.
        tt.store(hash, 2, 999, TtFlag::Exact);
        assert_eq!(tt.probe(hash, 4, -1000, 1000), Some(100));
    }
}
