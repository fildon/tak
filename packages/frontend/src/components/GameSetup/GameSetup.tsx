import { useState } from 'react';
import { SUPPORTED_SIZES } from '@tak/shared';
import type { StartGameOpts } from '../../hooks/useGameState';
import type { CpuColor, GameMode } from '../../types/gameMode';
import styles from './GameSetup.module.css';

interface Props {
  onStart: (opts: StartGameOpts) => void;
}

export function GameSetup({ onStart }: Props) {
  const [mode, setMode] = useState<GameMode>('pvp');
  const [cpuColor, setCpuColor] = useState<CpuColor>('black');
  const [size, setSize] = useState(5);

  const humanColor: CpuColor = cpuColor === 'white' ? 'black' : 'white';

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <h2 className={styles.title}>Tak</h2>

        <div className={styles.section}>
          <div className={styles.modeRow}>
            <button
              className={[styles.modeBtn, mode === 'pvp' && styles.active].filter(Boolean).join(' ')}
              onClick={() => setMode('pvp')}
            >
              Human vs Human
            </button>
            <button
              className={[styles.modeBtn, mode === 'pvc' && styles.active].filter(Boolean).join(' ')}
              onClick={() => setMode('pvc')}
            >
              Human vs CPU
            </button>
          </div>
        </div>

        {mode === 'pvc' && (
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
          onClick={() => onStart({ mode, cpuColor, size })}
        >
          Start Game
        </button>
      </div>
    </div>
  );
}
