import { useGameState } from './hooks/useGameState';
import { useValidMoves } from './hooks/useValidMoves';
import { Board } from './components/Board/Board';
import { PieceSelector } from './components/Controls/PieceSelector';
import { SlideControls } from './components/Controls/SlideControls';
import { SizeSelector } from './components/Controls/SizeSelector';
import { Header } from './components/Header/Header';
import { GameOverlay } from './components/GameOverlay/GameOverlay';
import styles from './App.module.css';

export default function App() {
  const game = useGameState();
  const { validPlaceCells, validDirections } = useValidMoves(
    game.gameState,
    game.uiPhase,
  );

  return (
    <div className={styles.app}>
      <Header gameState={game.gameState} />

      <main className={styles.main}>
        <SizeSelector
          currentSize={game.gameState.size}
          onSelect={game.newGame}
        />

        <Board
          gameState={game.gameState}
          uiPhase={game.uiPhase}
          validPlaceCells={validPlaceCells}
          onCellClick={game.clickCell}
          onStackClick={game.selectStack}
        />

        <div className={styles.controls}>
          {game.uiPhase.phase === 'sliding' ? (
            <SlideControls
              uiPhase={game.uiPhase}
              validDirections={validDirections}
              onCountChange={game.setSlideCount}
              onDirection={game.clickDirection}
            />
          ) : (
            <PieceSelector
              gameState={game.gameState}
              uiPhase={game.uiPhase}
              onSelect={game.selectPieceType}
            />
          )}
        </div>
      </main>

      {game.gameState.result && (
        <GameOverlay
          result={game.gameState.result}
          size={game.gameState.size}
          onNewGame={game.newGame}
        />
      )}
    </div>
  );
}
