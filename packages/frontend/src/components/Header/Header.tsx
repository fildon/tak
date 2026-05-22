import type { GameState } from '@tak/shared';
import styles from './Header.module.css';

interface Props {
  gameState: GameState;
}

export function Header({ gameState }: Props) {
  const { currentPlayer, players, turnNumber, result } = gameState;
  const isSwapTurn = turnNumber <= 2;

  return (
    <header className={styles.header}>
      <div className={styles.title}>Tak</div>

      {!result && (
        <div className={styles.turn}>
          <span
            className={[styles.swatch, styles[currentPlayer]].join(' ')}
            aria-hidden="true"
          />
          <span>
            {currentPlayer === 'white' ? 'White' : 'Black'} to move
            {isSwapTurn && <span className={styles.swap}> (swap)</span>}
          </span>
          <span className={styles.turnNum}>Turn {Math.ceil(turnNumber / 2)}</span>
        </div>
      )}

      <div className={styles.counts}>
        {(['white', 'black'] as const).map((color) => (
          <span key={color} className={styles.playerCount}>
            <span className={[styles.dot, styles[color]].join(' ')} />
            {players[color].flatCount}f
            {players[color].capstoneCount > 0 && ` ${players[color].capstoneCount}c`}
          </span>
        ))}
      </div>
    </header>
  );
}
