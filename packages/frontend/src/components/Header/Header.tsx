import type { GameState } from '@tak/shared';
import type { AiDifficulty, CpuColor, GameMode } from '../../types/gameMode';
import styles from './Header.module.css';

interface Props {
  gameState: GameState;
  gameMode: GameMode;
  cpuColor: CpuColor;
  difficulty: AiDifficulty;
}

export function Header({ gameState, gameMode, cpuColor, difficulty }: Props) {
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
            {gameMode === 'pvc' && color === cpuColor && (
              <span className={styles.cpuBadge}>
                CPU · {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
              </span>
            )}
          </span>
        ))}
      </div>
    </header>
  );
}
