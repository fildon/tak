/**
 * StackTooltip
 *
 * A floating panel rendered via React portal that shows every piece in a stack,
 * ordered top-to-bottom (last element first).  It escapes the board grid's
 * `overflow: hidden` and `container-type: size` by rendering at `document.body`.
 *
 * The caller is responsible for supplying an `anchorRect` (from
 * getBoundingClientRect) and for showing/hiding by setting anchorRect to null.
 */

import { createPortal } from 'react-dom';
import type { Stack } from '@tak/shared';
import { PieceGraphic } from '../Piece/PieceGraphic';
import styles from './StackTooltip.module.css';

interface Props {
  stack: Stack;
  /** DOMRect of the cell being hovered.  Null = do not render. */
  anchorRect: DOMRect | null;
}

export function StackTooltip({ stack, anchorRect }: Props) {
  if (!anchorRect || stack.length < 2) return null;

  // Centre horizontally above the cell; leave an 8 px gap.
  const left = anchorRect.left + anchorRect.width / 2;
  const top = anchorRect.top - 8;

  return createPortal(
    <div
      className={styles.tooltip}
      style={{ left, top }}
      role="tooltip"
      aria-label="Stack contents"
    >
      <div className={styles.header}>stack ({stack.length})</div>

      <ol className={styles.pieceList}>
        {/* Reverse so top piece is at the visual top of the list */}
        {[...stack].reverse().map((piece, i) => (
          <li
            key={i}
            className={[styles.row, i === 0 ? styles.topRow : ''].filter(Boolean).join(' ')}
          >
            <PieceGraphic piece={piece} mini />
            <span className={styles.label}>
              {piece.color} {piece.type}
              {i === 0 && <span className={styles.topTag}> ↑ top</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>,
    document.body,
  );
}
