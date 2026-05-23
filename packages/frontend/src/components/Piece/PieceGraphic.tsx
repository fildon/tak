import type { Piece } from '@tak/shared';
import styles from './PieceGraphic.module.css';

interface Props {
  piece: Piece;
  /** Render at reduced size for stack tooltips and similar compact contexts. */
  mini?: boolean;
}

export function PieceGraphic({ piece, mini }: Props) {
  return (
    <div
      className={[styles.piece, styles[piece.type], styles[piece.color], mini ? styles.mini : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={`${piece.color} ${piece.type}`}
    />
  );
}
