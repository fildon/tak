import { useRef, useState } from 'react';
import type { Stack } from '@tak/shared';
import { PieceGraphic } from '../Piece/PieceGraphic';
import { StackTooltip } from './StackTooltip';
import styles from './Cell.module.css';

interface Props {
  row: number;
  col: number;
  stack: Stack;
  isLight: boolean;
  isSelected: boolean;
  isValidPlace: boolean;
  isOwnStack: boolean;
  onClick: () => void;
}

export function Cell({
  stack,
  isLight,
  isSelected,
  isValidPlace,
  isOwnStack,
  onClick,
}: Props) {
  const top = stack.at(-1);
  const cellRef = useRef<HTMLDivElement>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<DOMRect | null>(null);

  const className = [
    styles.cell,
    isLight ? styles.light : styles.dark,
    isSelected && styles.selected,
    isValidPlace && styles.validPlace,
    !isSelected && isOwnStack && styles.ownStack,
  ]
    .filter(Boolean)
    .join(' ');

  const handleMouseEnter = () => {
    if (stack.length < 2) return;
    const rect = cellRef.current?.getBoundingClientRect();
    if (rect) setTooltipAnchor(rect);
  };

  const handleMouseLeave = () => setTooltipAnchor(null);

  return (
    <>
      <div
        ref={cellRef}
        className={className}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {top && <PieceGraphic piece={top} />}
        {stack.length > 1 && (
          <span className={styles.heightBadge}>{stack.length}</span>
        )}
      </div>

      <StackTooltip stack={stack} anchorRect={tooltipAnchor} />
    </>
  );
}
