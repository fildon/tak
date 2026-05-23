import { useEffect, useRef, useState } from 'react';
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

export function Cell({ stack, isLight, isSelected, isValidPlace, isOwnStack, onClick }: Props) {
  const top = stack.at(-1);
  const cellRef = useRef<HTMLDivElement>(null);

  // anchorRect: where to position the tooltip.
  // pinned: true when the user explicitly opened the tooltip via the badge
  //         (touch tap or mouse click on the badge).  Hover alone is not pinned.
  const [tooltipAnchor, setTooltipAnchor] = useState<DOMRect | null>(null);
  const [pinned, setPinned] = useState(false);

  // When pinned, dismiss on any interaction outside this cell.
  useEffect(() => {
    if (!pinned) return;
    const dismiss = (e: MouseEvent | TouchEvent) => {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) {
        setPinned(false);
        setTooltipAnchor(null);
      }
    };
    // Capture phase so we catch taps before they trigger other handlers.
    document.addEventListener('mousedown', dismiss, true);
    document.addEventListener('touchstart', dismiss, true);
    return () => {
      document.removeEventListener('mousedown', dismiss, true);
      document.removeEventListener('touchstart', dismiss, true);
    };
  }, [pinned]);

  // ---- desktop hover --------------------------------------------------------
  const handleMouseEnter = () => {
    if (stack.length < 2 || pinned) return;
    const rect = cellRef.current?.getBoundingClientRect();
    if (rect) setTooltipAnchor(rect);
  };

  const handleMouseLeave = () => {
    // Don't hide when the user has pinned it open.
    if (!pinned) setTooltipAnchor(null);
  };

  // ---- badge click / tap (desktop + mobile) ---------------------------------
  const handleBadgeClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Don't let the click bubble up to the cell's onClick (which selects the
    // stack for a slide move).
    e.stopPropagation();
    if (pinned) {
      // Second tap on badge = dismiss.
      setPinned(false);
      setTooltipAnchor(null);
    } else {
      const rect = cellRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltipAnchor(rect);
        setPinned(true);
      }
    }
  };

  const className = [
    styles.cell,
    isLight ? styles.light : styles.dark,
    isSelected && styles.selected,
    isValidPlace && styles.validPlace,
    !isSelected && isOwnStack && styles.ownStack,
  ]
    .filter(Boolean)
    .join(' ');

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
          <button
            className={[styles.heightBadge, pinned ? styles.badgePinned : '']
              .filter(Boolean)
              .join(' ')}
            onClick={handleBadgeClick}
            aria-label={`Stack of ${stack.length} pieces — tap to inspect`}
            aria-expanded={pinned}
          >
            {stack.length}
          </button>
        )}
      </div>

      <StackTooltip stack={stack} anchorRect={tooltipAnchor} />
    </>
  );
}
