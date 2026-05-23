import { useState } from 'react';
import type { Move } from '@tak/shared';
import { moveToPtn } from '../../utils/ptn';
import styles from './MoveHistory.module.css';

interface Props {
  moves: Move[];
  size: number;
}

export function MoveHistory({ moves, size }: Props) {
  const [open, setOpen] = useState(false);

  if (moves.length === 0) return null;

  return (
    <div className={styles.container}>
      <button className={styles.toggle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        History ({moves.length})
        <span className={styles.chevron} aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
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
