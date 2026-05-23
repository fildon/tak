import type { GameState } from '@tak/shared';
import type { AiDifficulty, CpuColor, GameMode } from '../types/gameMode';

const SAVE_KEY = 'tak_saved_game';

export interface SavedGame {
  gameState: GameState;
  gameMode: GameMode;
  cpuColor: CpuColor;
  difficulty: AiDifficulty;
  savedAt: string; // ISO timestamp
}

export function saveGame(data: SavedGame): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private browsing, storage quota exceeded, etc.)
  }
}

export function loadSavedGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedGame;
  } catch {
    return null;
  }
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
