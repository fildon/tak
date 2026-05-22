/**
 * getCpuMove.ts
 *
 * Thin async wrapper around the Wasm engine Web Worker.
 * Returns a Promise<Move> that resolves when the engine replies.
 *
 * The worker is created lazily on the first call and reused thereafter.
 * A numeric `id` is used to match replies to callers, so stale replies
 * from a previous (cancelled) search are silently ignored.
 */

import type { GameState, Move } from '@tak/shared';

// Default thinking time: 1.5 s gives decent depth while feeling responsive.
export const DEFAULT_TIME_MS = 1500;

// ---------------------------------------------------------------------------
// Worker singleton
// ---------------------------------------------------------------------------

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (m: Move) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/engine.worker', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
      const { id, moveJson, error } = e.data as {
        id: number;
        moveJson?: string;
        error?: string;
      };
      const entry = pending.get(id);
      if (!entry) return; // stale reply — search was already cancelled
      pending.delete(id);
      if (error) {
        entry.reject(new Error(error));
      } else {
        entry.resolve(JSON.parse(moveJson!) as Move);
      }
    };
    worker.onerror = (e) => {
      console.error('Engine worker error:', e);
    };
  }
  return worker;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getCpuMove(
  state: GameState,
  timeBudgetMs: number = DEFAULT_TIME_MS,
): Promise<Move> {
  return new Promise<Move>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({
      id,
      stateJson: JSON.stringify(state),
      timeBudgetMs,
    });
  });
}
