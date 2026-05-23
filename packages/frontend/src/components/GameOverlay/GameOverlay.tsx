import type { GameResult } from '@tak/shared';
import styles from './GameOverlay.module.css';

interface Props {
  result: GameResult;
  onPlayAgain: () => void;
  onReview: () => void;
}

const REASON_LABEL: Record<GameResult['reason'], string> = {
  road: 'by road',
  flats: 'by flat count',
  draw: 'equal flat count',
  resign: 'by resignation',
};

export function GameOverlay({ result, onPlayAgain, onReview }: Props) {
  const isDraw = result.winner === null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.card}>
        {isDraw ? (
          <div className={[styles.swatch, styles.draw].join(' ')} />
        ) : (
          <div className={[styles.swatch, styles[result.winner!]].join(' ')} />
        )}

        <h2 className={styles.winnerText}>
          {isDraw ? 'Draw' : `${result.winner === 'white' ? 'White' : 'Black'} wins`}
        </h2>
        <p className={styles.reason}>{REASON_LABEL[result.reason]}</p>

        <button className={styles.playAgain} onClick={onPlayAgain}>
          Play again
        </button>
        <button className={styles.reviewButton} onClick={onReview}>
          Review game
        </button>
      </div>
    </div>
  );
}
