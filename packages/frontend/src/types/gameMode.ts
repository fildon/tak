export type GameMode = 'pvp' | 'pvc';
export type CpuColor = 'white' | 'black';
export type AiDifficulty = 'easy' | 'medium' | 'hard';

export const AI_DIFFICULTY_MS: Record<AiDifficulty, number> = {
  easy:   300,
  medium: 1500,
  hard:   4000,
};
