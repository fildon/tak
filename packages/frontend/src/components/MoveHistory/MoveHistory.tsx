import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Move } from '@tak/shared';
import { moveToPtn } from '../../utils/ptn';
import styles from './MoveHistory.module.css';

interface Props {
  moves: Move[];
  size: number;
  rightSlot?: ReactNode;
}

export function MoveHistory({ moves, size, rightSlot }: Props) {
  const [open, setOpen] = useState(false);
  const hasHistory = moves.length > 0;

  if (!hasHistory && !rightSlot) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.toggleSide}>
          {hasHistory && (
            <button
              className={styles.toggle}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              History ({moves.length})
              <span className={styles.chevron} aria-hidden="true">
                {open ? '▲' : '▼'}
              </span>
            </button>
          )}
        </div>
        {rightSlot && <div className={styles.rightSlot}>{rightSlot}</div>}
      </div>

      {open && hasHistory && (
        <ol className={styles.list}>
          {moves.map((move, i) => {
            const player = i % 2 === 0 ? 'white' : 'black';
            return (
              <li key={i} className={styles.entry}>
                <span className={[styles.dot, styles[player]].join(' ')} aria-hidden="true" />
                <span className={styles.index}>{i + 1}</span>
                <span className={styles.ptn}>{moveToPtn(move, size)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
