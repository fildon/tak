import type { Direction } from '@tak/shared';
import type { UIPhase } from '../../types/uiState';
import styles from './SlideControls.module.css';

interface Props {
  uiPhase: Extract<UIPhase, { phase: 'sliding' }>;
  validDirections: Set<Direction>;
  onCountChange: (n: number) => void;
  onDirection: (dir: Direction) => void;
}

// Maps screen arrow to PTN direction. '+' = row-- = up on screen.
const ARROW_MAP: Array<{ dir: Direction; label: string; area: string }> = [
  { dir: '+', label: '↑', area: 'up' },
  { dir: '-', label: '↓', area: 'down' },
  { dir: '<', label: '←', area: 'left' },
  { dir: '>', label: '→', area: 'right' },
];

export function SlideControls({ uiPhase, validDirections, onCountChange, onDirection }: Props) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>Slide</span>

      <div className={styles.carryRow}>
        <span className={styles.carryLabel}>Carry</span>
        <button
          className={styles.nudge}
          onClick={() => onCountChange(uiPhase.count - 1)}
          disabled={uiPhase.count <= 1}
          aria-label="Carry fewer pieces"
        >−</button>
        <span
          className={styles.countVal}
          aria-label={`Carrying ${uiPhase.count} of ${uiPhase.maxCount}`}
        >
          {uiPhase.count}
        </span>
        <button
          className={styles.nudge}
          onClick={() => onCountChange(uiPhase.count + 1)}
          disabled={uiPhase.count >= uiPhase.maxCount}
          aria-label="Carry more pieces"
        >+</button>
        <span className={styles.carryMax}>of {uiPhase.maxCount}</span>
      </div>

      <div className={styles.dpad}>
        {ARROW_MAP.map(({ dir, label, area }) => {
          const valid = validDirections.has(dir);
          return (
            <button
              key={dir}
              className={[styles.dirBtn, valid && styles.valid].filter(Boolean).join(' ')}
              style={{ gridArea: area }}
              disabled={!valid}
              onClick={() => onDirection(dir)}
              aria-label={`Slide ${area}`}
            >
              {label}
            </button>
          );
        })}
        <div className={styles.dpadCenter} style={{ gridArea: 'center' }} aria-hidden="true" />
      </div>
    </div>
  );
}
