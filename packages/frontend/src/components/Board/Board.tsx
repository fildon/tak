import type { GameState } from '@tak/shared';
import type { UIPhase } from '../../types/uiState';
import { Cell } from './Cell';
import styles from './Board.module.css';

interface Props {
  gameState: GameState;
  uiPhase: UIPhase;
  validPlaceCells: Set<string>;
  onCellClick: (row: number, col: number) => void;
  onStackClick: (row: number, col: number) => void;
  className?: string;
}

export function Board({
  gameState,
  uiPhase,
  validPlaceCells,
  onCellClick,
  onStackClick,
  className,
}: Props) {
  const { board, size, currentPlayer } = gameState;

  const selectedRow = uiPhase.phase === 'sliding' ? uiPhase.row : -1;
  const selectedCol = uiPhase.phase === 'sliding' ? uiPhase.col : -1;

  return (
    <div
      className={[styles.grid, className].filter(Boolean).join(' ')}
      style={{ '--board-size': size } as React.CSSProperties}
    >
      {board.flatMap((rowArr, r) =>
        rowArr.map((stack, c) => {
          const top = stack.at(-1);
          const isOwnStack = !!top && top.color === currentPlayer;
          const isSelected = r === selectedRow && c === selectedCol;
          const isValidPlace = validPlaceCells.has(`${r},${c}`);

          return (
            <Cell
              key={`${r},${c}`}
              row={r}
              col={c}
              stack={stack}
              isLight={(r + c) % 2 === 1}
              isSelected={isSelected}
              isValidPlace={isValidPlace}
              isOwnStack={isOwnStack && !isSelected}
              onClick={stack.length > 0 ? () => onStackClick(r, c) : () => onCellClick(r, c)}
            />
          );
        }),
      )}
    </div>
  );
}
