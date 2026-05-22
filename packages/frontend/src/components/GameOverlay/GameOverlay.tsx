import { SUPPORTED_SIZES } from '@tak/shared';
import type { GameResult } from '@tak/shared';
import styles from './GameOverlay.module.css';

interface Props {
  result: GameResult;
  size: number;
  onNewGame: (size: number) => void;
}

const REASON_LABEL: Record<GameResult['reason'], string> = {
  road: 'by road',
  flats: 'by flat count',
  resign: 'by resignation',
};

export function GameOverlay({ result, size, onNewGame }: Props) {
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.card}>
        <div className={[styles.swatch, styles[result.winner]].join(' ')} />
        <h2 className={styles.winner}>
          {result.winner === 'white' ? 'White' : 'Black'} wins
        </h2>
        <p className={styles.reason}>{REASON_LABEL[result.reason]}</p>

        <button className={styles.playAgain} onClick={() => onNewGame(size)}>
          Play again
        </button>

        <div className={styles.sizes}>
          {SUPPORTED_SIZES.map((s) => (
            <button
              key={s}
              className={[styles.sizeBtn, s === size && styles.active].filter(Boolean).join(' ')}
              onClick={() => onNewGame(s)}
            >
              {s}×{s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
