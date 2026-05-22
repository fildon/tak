import { useState } from 'react';
import { useGameState } from './hooks/useGameState';
import { useValidMoves } from './hooks/useValidMoves';
import { Board } from './components/Board/Board';
import { PieceSelector } from './components/Controls/PieceSelector';
import { SlideControls } from './components/Controls/SlideControls';
import { DistributeControls } from './components/Controls/DistributeControls';
import { SizeSelector } from './components/Controls/SizeSelector';
import { Header } from './components/Header/Header';
import { GameOverlay } from './components/GameOverlay/GameOverlay';
import { GameSetup } from './components/GameSetup/GameSetup';
import styles from './App.module.css';

export default function App() {
  const game = useGameState();
  const { validPlaceCells, validDirections } = useValidMoves(
    game.gameState,
    game.uiPhase,
  );
  const [showSetup, setShowSetup] = useState(true);

  const isThinking = game.uiPhase.phase === 'cpu-thinking';

  return (
    <div className={styles.app}>
      <Header
        gameState={game.gameState}
        gameMode={game.gameMode}
        cpuColor={game.cpuColor}
      />

      <main className={styles.main}>
        <SizeSelector
          currentSize={game.gameState.size}
          onSelect={(size) => game.startGame({ mode: game.gameMode, cpuColor: game.cpuColor, size })}
        />

        <Board
          gameState={game.gameState}
          uiPhase={game.uiPhase}
          validPlaceCells={validPlaceCells}
          onCellClick={game.clickCell}
          onStackClick={game.selectStack}
          className={isThinking ? styles.thinking : undefined}
        />

        <div className={styles.controls}>
          {game.uiPhase.phase === 'distributing' ? (
            <DistributeControls
              uiPhase={game.uiPhase}
              onDropChange={game.setDropAt}
              onRemoveStep={game.removeLastStep}
              onAddStep={game.addStep}
              onConfirm={game.confirmSlide}
              onCancel={game.cancelSelection}
            />
          ) : game.uiPhase.phase === 'sliding' ? (
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
          onPlayAgain={() => setShowSetup(true)}
        />
      )}

      {showSetup && (
        <GameSetup
          onStart={(opts) => {
            game.startGame(opts);
            setShowSetup(false);
          }}
        />
      )}
    </div>
  );
}
