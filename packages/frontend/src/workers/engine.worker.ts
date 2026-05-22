/**
 * engine.worker.ts
 *
 * Runs the Rust/Wasm Tak engine on a dedicated thread so the main thread
 * (and React UI) never blocks during search.
 *
 * Protocol
 * --------
 * Incoming:  { id: number; stateJson: string; timeBudgetMs: number }
 * Outgoing:  { id: number; moveJson: string }   — success
 *            { id: number; error: string }       — failure
 *
 * The `id` field lets the caller match replies to requests (important
 * when a new search is started before the previous reply arrives).
 */

import init, { get_best_move } from '@tak/engine';

// Initialise the wasm module once, then signal readiness.
// All incoming messages are queued until init resolves.
let wasmReady: Promise<void> = init().then(() => undefined);

self.onmessage = async (e: MessageEvent) => {
  const { id, stateJson, timeBudgetMs } = e.data as {
    id: number;
    stateJson: string;
    timeBudgetMs: number;
  };

  try {
    await wasmReady;
    const moveJson = get_best_move(stateJson, timeBudgetMs);
    // The engine returns {"error":"..."} on failure — surface as a thrown error.
    const parsed = JSON.parse(moveJson) as Record<string, unknown>;
    if (parsed['error']) {
      throw new Error(parsed['error'] as string);
    }
    self.postMessage({ id, moveJson });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
