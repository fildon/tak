import type { UIPhase } from '../../types/uiState';
import styles from './DistributeControls.module.css';

const DIR_ARROW: Record<string, string> = {
  '+': '↑', '-': '↓', '<': '←', '>': '→',
};

interface Props {
  uiPhase: Extract<UIPhase, { phase: 'distributing' }>;
  onDropChange: (index: number, value: number) => void;
  onRemoveStep: () => void;
  onAddStep: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DistributeControls({
  uiPhase,
  onDropChange,
  onRemoveStep,
  onAddStep,
  onConfirm,
  onCancel,
}: Props) {
  const { drops, count, direction, maxSteps } = uiPhase;
  const sum = drops.reduce((a, b) => a + b, 0);
  const isValid = sum === count && drops.every((d) => d >= 1);
  const canRemove = drops.length > 1;
  const canAdd = drops.length < maxSteps && drops[drops.length - 1] > 1;

  return (
    <div className={styles.root}>
      <div className={styles.topRow}>
        <button className={styles.backBtn} onClick={onCancel}>
          ← Back
        </button>
        <span className={styles.heading}>
          Drop distribution {DIR_ARROW[direction]}
        </span>
        <span className={[styles.sum, isValid ? styles.valid : styles.invalid].join(' ')}>
          {sum}/{count}
        </span>
      </div>

      <div className={styles.stepsRow}>
        {drops.map((d, i) => (
          <div key={i} className={styles.step}>
            <button
              className={styles.nudge}
              onClick={() => onDropChange(i, d + 1)}
              tabIndex={-1}
            >▲</button>
            <input
              className={styles.input}
              type="number"
              min={1}
              value={d}
              onChange={(e) => onDropChange(i, parseInt(e.target.value) || 1)}
            />
            <button
              className={styles.nudge}
              onClick={() => onDropChange(i, d - 1)}
              disabled={d <= 1}
              tabIndex={-1}
            >▼</button>
          </div>
        ))}

        <div className={styles.pathBtns}>
          {canAdd && (
            <button className={styles.pathBtn} onClick={onAddStep} title="Extend path one more cell">
              +cell
            </button>
          )}
          {canRemove && (
            <button className={styles.pathBtn} onClick={onRemoveStep} title="Shorten path by one cell">
              −cell
            </button>
          )}
        </div>
      </div>

      <button
        className={styles.confirmBtn}
        onClick={onConfirm}
        disabled={!isValid}
      >
        Slide {DIR_ARROW[direction]}
      </button>
    </div>
  );
}
