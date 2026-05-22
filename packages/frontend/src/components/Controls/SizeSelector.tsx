import { SUPPORTED_SIZES } from '@tak/shared';
import styles from './SizeSelector.module.css';

interface Props {
  currentSize: number;
  onSelect: (size: number) => void;
}

export function SizeSelector({ currentSize, onSelect }: Props) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>Board:</span>
      {SUPPORTED_SIZES.map((s) => (
        <button
          key={s}
          className={[styles.btn, s === currentSize && styles.active].filter(Boolean).join(' ')}
          onClick={() => onSelect(s)}
          aria-pressed={s === currentSize}
        >
          {s}×{s}
        </button>
      ))}
    </div>
  );
}
