use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Piece types
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PieceType {
    Flat,
    Wall,
    Capstone,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Color {
    White,
    Black,
}

impl Color {
    #[inline]
    pub fn opponent(self) -> Color {
        match self {
            Color::White => Color::Black,
            Color::Black => Color::White,
        }
    }
}

/// A single piece on the board.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
pub struct Piece {
    /// Serialises as "type" to match TypeScript.
    #[serde(rename = "type")]
    pub typ: PieceType,
    pub color: Color,
}

// ---------------------------------------------------------------------------
// Direction
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Direction {
    North, // '+'
    South, // '-'
    East,  // '>'
    West,  // '<'
}

impl Direction {
    pub const ALL: [Direction; 4] = [
        Direction::North,
        Direction::South,
        Direction::East,
        Direction::West,
    ];

    #[inline]
    pub fn delta(self) -> (i32, i32) {
        match self {
            Direction::North => (-1, 0),
            Direction::South => (1, 0),
            Direction::East => (0, 1),
            Direction::West => (0, -1),
        }
    }
}

impl Serialize for Direction {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(match self {
            Direction::North => "+",
            Direction::South => "-",
            Direction::East => ">",
            Direction::West => "<",
        })
    }
}

impl<'de> Deserialize<'de> for Direction {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let s = String::deserialize(d)?;
        match s.as_str() {
            "+" => Ok(Direction::North),
            "-" => Ok(Direction::South),
            ">" => Ok(Direction::East),
            "<" => Ok(Direction::West),
            _ => Err(serde::de::Error::custom(format!("unknown direction: {s}"))),
        }
    }
}

// ---------------------------------------------------------------------------
// Move
// ---------------------------------------------------------------------------

/// Matches the TypeScript Move discriminated union exactly.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Move {
    Place {
        #[serde(rename = "pieceType")]
        piece_type: PieceType,
        row: usize,
        col: usize,
    },
    Slide {
        row: usize,
        col: usize,
        direction: Direction,
        drops: Vec<u32>,
    },
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerState {
    pub flat_count: i32,
    pub capstone_count: i32,
}

/// Matches TypeScript `Record<Color, PlayerState>` which serialises as
/// `{"white": {...}, "black": {...}}`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Players {
    pub white: PlayerState,
    pub black: PlayerState,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GameResult {
    pub winner: Color,
    pub reason: String,
}

/// Deserialised from the TypeScript GameState JSON.
/// Unknown fields (e.g. `moveHistory`) are silently ignored by serde.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameState {
    /// `board[row][col]` — stack is bottom-first, same convention as TypeScript.
    pub board: Vec<Vec<Vec<Piece>>>,
    pub size: usize,
    pub current_player: Color,
    pub players: Players,
    pub turn_number: u32,
    #[serde(default)]
    pub result: Option<GameResult>,
}

impl GameState {
    #[inline]
    pub fn player(&self, color: Color) -> &PlayerState {
        match color {
            Color::White => &self.players.white,
            Color::Black => &self.players.black,
        }
    }

    #[inline]
    pub fn player_mut(&mut self, color: Color) -> &mut PlayerState {
        match color {
            Color::White => &mut self.players.white,
            Color::Black => &mut self.players.black,
        }
    }
}

