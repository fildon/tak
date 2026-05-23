# Tak — Claude Code Instructions

## Project structure

```
packages/
  shared/    TypeScript types and game logic (ESM, consumed by frontend)
  frontend/  React 18 + Vite SPA with CSS Modules
  engine/    Rust → WebAssembly AI engine (wasm-pack, runs in a Web Worker)
```

## Key commands

```bash
npm run build        # build all packages (Rust → Wasm, tsc, vite build)
npm run dev          # start all dev watchers; frontend at localhost:3000
npm run type-check   # TypeScript type-check without emit
```

## Development workflow

Every piece of work follows these steps in order:

1. **Issue** — every change is tracked as a GitHub issue on `fildon/tak`.
   Open one with `gh issue create` if it doesn't already exist.

2. **Plan** — enter plan mode and propose an implementation plan before writing any code.
   Wait for explicit user approval before proceeding.

3. **Branch** — implement on a feature branch, never directly on `main`.
   Branch naming: `feat/issue-N-short-description` or `fix/issue-N-short-description`.

4. **Implement** — make the changes. Run `npm run type-check` and `npm run build`
   before considering work done.

5. **PR** — open a pull request with `gh pr create`. The PR body must include
   `Closes #N` so the issue closes automatically on merge. Do not merge PRs yourself —
   leave that to the user.

6. **Review** — the user reviews and merges. The issue closes automatically.

## Things Claude must not do

- Push directly to `main`
- Merge PRs
- Amend commits that have already been pushed

## Code style

- TypeScript strict mode is on; no `any` types
- CSS Modules for all component styles
- No linter is configured yet — follow the patterns in surrounding code
- Commit messages: imperative mood, reference issue with `Closes #N` in the body
