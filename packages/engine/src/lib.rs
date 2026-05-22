mod apply;
mod eval;
mod movegen;
mod search;
mod types;

use wasm_bindgen::prelude::*;

/// Find the best move for the current player.
///
/// # Arguments
/// * `state_json` — JSON-serialised `GameState` (TypeScript shape).
/// * `time_budget_ms` — wall-clock milliseconds the search may use.
///
/// # Returns
/// JSON-serialised `Move` (TypeScript shape).
#[wasm_bindgen]
pub fn get_best_move(state_json: &str, time_budget_ms: f64) -> String {
    let state: types::GameState = match serde_json::from_str(state_json) {
        Ok(s) => s,
        Err(e) => {
            // Return a sentinel that the TypeScript side can detect.
            return format!("{{\"error\":\"{e}\"}}");
        }
    };

    if state.result.is_some() {
        return "{\"error\":\"game is already over\"}".into();
    }

    let mv = search::find_best_move(&state, time_budget_ms);
    serde_json::to_string(&mv).unwrap_or_else(|e| format!("{{\"error\":\"{e}\"}}"))
}
