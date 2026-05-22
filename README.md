# Tak

A web app for playing the board game [Tak](https://cheapass.com/tak/), built with a clean 2D aesthetic in the style of chess.com.

## Monorepo structure

```
tak/
  packages/
    shared/     # TypeScript types, game logic, move validation
    frontend/   # React + Vite  (Phase 1)
    backend/    # Node + Socket.io for real-time PvP  (Phase 2)
    engine/     # Rust AI engine, communicates over stdin/stdout  (Phase 2)
```

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node, TypeScript, Socket.io |
| Shared | TypeScript (compiled CommonJS, consumed by all packages) |
| AI engine | Rust |
| Monorepo | npm workspaces + Turborepo |

## Deployment

- **Frontend** → Vercel (pointed at `packages/frontend`)
- **Backend + engine** → Fly.io via Docker (multi-stage build: Rust binary + Node runtime)

## Getting started

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Start all dev watchers
npm run dev
```

Requires Node 20+ and npm 10+.

## Game rules

Tak is a two-player abstract strategy game. Each player tries to build a **road** — a connected path of their pieces linking opposite edges of the board.

**Pieces:**
- **Flat stone** — the basic piece; counts toward roads and the flat-stone tiebreaker
- **Standing stone (wall)** — blocks movement and roads; cannot be part of a road
- **Capstone** — counts toward roads; can flatten walls by moving onto them

**Turn structure:**
- **Turns 1 & 2 (swap):** each player places one of the *opponent's* flat stones
- **Turn 3 onwards:** place a piece from your hand onto an empty square, or pick up a stack and slide it in a straight line

**Win conditions:**
1. **Road win** — connect two opposite edges with a continuous path of flats and/or capstones
2. **Flat win** — when the board fills or a player runs out of pieces, the player with the most flat stones on top of stacks wins

See the [official rulebook](https://cheapass.com/tak/) for full details.
