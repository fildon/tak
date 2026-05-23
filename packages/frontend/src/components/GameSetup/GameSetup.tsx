import { useState } from 'react';
import { SUPPORTED_SIZES } from '@tak/shared';
import type { StartGameOpts } from '../../hooks/useGameState';
import type { AiDifficulty, CpuColor, GameMode } from '../../types/gameMode';
import type { SavedGame } from '../../utils/savedGame';
import styles from './GameSetup.module.css';

interface Props {
  onStart: (opts: StartGameOpts) => void;
  savedGame?: SavedGame | null;
  onResume?: () => void;
}

function resumeMeta(saved: SavedGame): string {
  const turn = Math.ceil(saved.gameState.turnNumber / 2);
  const size = `${saved.gameState.size}×${saved.gameState.size}`;
  const mode = saved.gameMode === 'pvp' ? 'Human vs Human' : 'vs CPU';
  const diffMs = Date.now() - new Date(saved.savedAt).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  const age =
    diffMin < 1
      ? 'just now'
      : diffMin < 60
        ? `${diffMin}m ago`
        : `${Math.floor(diffMin / 60)}h ago`;
  return `${size} · Turn ${turn} · ${mode} · ${age}`;
}

export function GameSetup({ onStart, savedGame, onResume }: Props) {
  const [mode, setMode] = useState<GameMode>('pvp');
  const [cpuColor, setCpuColor] = useState<CpuColor>('black');
  const [size, setSize] = useState(5);
  const [difficulty, setDifficulty] = useState<AiDifficulty>('medium');

  const DIFFICULTIES: AiDifficulty[] = ['easy', 'medium', 'hard'];

  const humanColor: CpuColor = cpuColor === 'white' ? 'black' : 'white';

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <h2 className={styles.title}>Tak</h2>

        {savedGame && onResume && (
          <>
            <div className={styles.resumeSection}>
              <div className={styles.label}>Saved game</div>
              <div className={styles.resumeMeta}>{resumeMeta(savedGame)}</div>
              <button className={styles.resumeBtn} onClick={onResume}>
                Resume
              </button>
            </div>
            <hr className={styles.divider} />
          </>
        )}

        <div className={styles.section}>
          <div className={styles.modeRow}>
            <button
              className={[styles.modeBtn, mode === 'pvp' && styles.active]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setMode('pvp')}
            >
              Human vs Human
            </button>
            <button
              className={[styles.modeBtn, mode === 'pvc' && styles.active]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setMode('pvc')}
            >
              Human vs CPU
            </button>
          </div>
        </div>

        {mode === 'pvc' && (
          <>
            <div className={styles.section}>
              <div className={styles.label}>I play as</div>
              <div className={styles.colorRow}>
                <label className={styles.colorOpt}>
                  <input
                    type="radio"
                    name="human-color"
                    checked={humanColor === 'white'}
                    onChange={() => setCpuColor('black')}
                  />
                  <span className={[styles.swatch, styles.white].join(' ')} />
                  White
                </label>
                <label className={styles.colorOpt}>
                  <input
                    type="radio"
                    name="human-color"
                    checked={humanColor === 'black'}
                    onChange={() => setCpuColor('white')}
                  />
                  <span className={[styles.swatch, styles.black].join(' ')} />
                  Black
                </label>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.label}>Difficulty</div>
              <div className={styles.difficultyRow}>
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    className={[styles.sizeBtn, d === difficulty && styles.active]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setDifficulty(d)}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className={styles.section}>
          <div className={styles.label}>Board size</div>
          <div className={styles.sizeRow}>
            {SUPPORTED_SIZES.map((s) => (
              <button
                key={s}
                className={[styles.sizeBtn, s === size && styles.active].filter(Boolean).join(' ')}
                onClick={() => setSize(s)}
              >
                {s}×{s}
              </button>
            ))}
          </div>
        </div>

        <button
          className={styles.startBtn}
          onClick={() => onStart({ mode, cpuColor, size, difficulty })}
        >
          Start Game
        </button>
      </div>
    </div>
  );
}
