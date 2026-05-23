# Tak

A web app for playing the board game [Tak](https://cheapass.com/tak/), built with a clean 2D aesthetic in the style of chess.com.

**[▶ Play now →](https://rupertmckay.com/tak/)**

## Monorepo structure

```
tak/
  packages/
    shared/     # TypeScript types, game logic, move validation
    frontend/   # React + Vite  (single-page app)
    engine/     # Rust AI engine compiled to WebAssembly via wasm-pack
```

## Tech stack

| Layer        | Tech                                        |
| ------------ | ------------------------------------------- |
| Frontend     | React 18, TypeScript, Vite 5                |
| AI engine    | Rust → WebAssembly (wasm-pack)              |
| Shared logic | TypeScript (CommonJS, consumed by frontend) |
| Monorepo     | npm workspaces + Turborepo                  |

## Architecture

### AI engine (Wasm)

The Rust engine (`packages/engine`) compiles to a `.wasm` binary via `wasm-pack` and runs entirely in the browser inside a **Web Worker** — the main React thread never blocks during search.

```
React UI  ──postMessage──►  engine.worker.ts  ──Wasm call──►  tak_engine.wasm
          ◄──postMessage──                    ◄──────────────
```

The Rust crate has no Wasm-specific code beyond `lib.rs` (the `#[wasm_bindgen]` entry point) and `js_sys::Date::now()` for timing. The same source compiles to a native binary if a CLI or server-side use case ever arises.

**Why Wasm is sufficient here:**

- Zero deployment cost — the `.wasm` file is a static asset served by Vite alongside the JS bundle
- No backend required for single-player (PvC) — the whole app deploys to Vercel as a static site
- No cold-start latency — the engine initialises once per page load and stays resident
- Works offline

**When a native process would be needed instead:**
Online multiplayer would require a `packages/backend` (Node + Socket.io). If server-side AI were also needed (e.g. an always-available AI opponent, or a deep analysis service), the Rust crate compiles natively without source changes — it could be called from Node via `child_process` or a NAPI addon.

### AI algorithm

Iterative-deepening negamax with alpha-beta pruning. Starts at depth 1 and deepens until the time budget (default 1.5 s) expires, always returning the best move from the last completed depth. Move ordering (shallow apply + eval at each node) improves cut-off rates significantly.

## Deployment

- **Frontend + Wasm** → Vercel (pointed at `packages/frontend`). No server required.

## Getting started

```bash
# Install dependencies
npm install

# Build all packages (compiles Rust → Wasm, then TypeScript)
npm run build

# Start all dev watchers
npm run dev
```

Requires Node 20+, npm 10+, and a Rust toolchain with `wasm-pack`:

```bash
cargo install wasm-pack
```

## Game rules

Tak is a two-player abstract strategy game. Each player tries to build a **road** — a connected path of their pieces linking opposite edges of the board.

**Pieces:**

- **Flat stone** — the basic piece; counts toward roads and the flat-stone tiebreaker
- **Standing stone (wall)** — blocks movement and roads; cannot be part of a road
- **Capstone** — counts toward roads; can flatten walls by moving onto them

**Turn structure:**

- **Turns 1 & 2 (swap):** each player places one of the _opponent's_ flat stones
- **Turn 3 onwards:** place a piece from your hand onto an empty square, or pick up a stack and slide it in a straight line

**Win conditions:**

1. **Road win** — connect two opposite edges with a continuous path of flats and/or capstones
2. **Flat win** — when the board fills or a player runs out of pieces, the player with the most flat stones on top of stacks wins
3. **Draw** — if flat counts are equal at game end, the game is a draw

See the [official rulebook](https://cheapass.com/tak/) for full details.
