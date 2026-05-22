import type { Piece } from '@tak/shared';
import styles from './PieceGraphic.module.css';

interface Props {
  piece: Piece;
}

export function PieceGraphic({ piece }: Props) {
  return (
    <div
      className={[
        styles.piece,
        styles[piece.type],
        styles[piece.color],
      ].join(' ')}
      aria-label={`${piece.color} ${piece.type}`}
    />
  );
}
