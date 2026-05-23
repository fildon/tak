import type { GameState, PieceType } from '@tak/shared';
import type { UIPhase } from '../../types/uiState';
import styles from './PieceSelector.module.css';

interface Props {
  gameState: GameState;
  uiPhase: UIPhase;
  onSelect: (pt: PieceType) => void;
}

const PIECES: Array<{ type: PieceType; label: string }> = [
  { type: 'flat', label: 'Flat' },
  { type: 'wall', label: 'Wall' },
  { type: 'capstone', label: 'Cap' },
];

export function PieceSelector({ gameState, uiPhase, onSelect }: Props) {
  const isSwapTurn = gameState.turnNumber <= 2;
  const player = gameState.players[gameState.currentPlayer];
  const activePiece = uiPhase.phase === 'placing' ? uiPhase.pieceType : null;

  return (
    <div className={styles.row}>
      {PIECES.map(({ type, label }) => {
        if (isSwapTurn && type !== 'flat') return null;

        const noFlats = type !== 'capstone' && player.flatCount === 0;
        const noCaps = type === 'capstone' && player.capstoneCount === 0;
        const disabled = isSwapTurn || noFlats || noCaps;
        const isActive = activePiece === type;

        return (
          <button
            key={type}
            className={[styles.btn, isActive && styles.active].filter(Boolean).join(' ')}
            onClick={() => onSelect(type)}
            disabled={disabled && !isSwapTurn}
            aria-pressed={isActive}
            title={
              type === 'capstone' && player.capstoneCount === 0
                ? 'No capstones remaining'
                : undefined
            }
          >
            {label}
            {type === 'capstone' && <span className={styles.count}> ×{player.capstoneCount}</span>}
            {type === 'flat' && <span className={styles.count}> ×{player.flatCount}</span>}
          </button>
        );
      })}
      {isSwapTurn && <span className={styles.hint}>Swap turn — place opponent's flat</span>}
    </div>
  );
}
