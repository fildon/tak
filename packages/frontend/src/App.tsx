import { useEffect, useState } from 'react';
import { useGameState } from './hooks/useGameState';
import { useValidMoves } from './hooks/useValidMoves';
import { Board } from './components/Board/Board';
import { PieceSelector } from './components/Controls/PieceSelector';
import { SlideControls } from './components/Controls/SlideControls';
import { DistributeControls } from './components/Controls/DistributeControls';
import { Header } from './components/Header/Header';
import { GameOverlay } from './components/GameOverlay/GameOverlay';
import { GameSetup } from './components/GameSetup/GameSetup';
import { MoveHistory } from './components/MoveHistory/MoveHistory';
import { loadSavedGame, type SavedGame } from './utils/savedGame';
import styles from './App.module.css';

export default function App() {
  const game = useGameState();
  const { validPlaceCells, validDirections } = useValidMoves(game.gameState, game.uiPhase);
  const [showSetup, setShowSetup] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [confirmingResign, setConfirmingResign] = useState(false);
  // Read once at mount — cleared after the user acts on it (resume or new game).
  const [savedGame, setSavedGame] = useState<SavedGame | null>(() => loadSavedGame());

  // Cancel resign confirmation automatically when a move is made
  useEffect(() => {
    setConfirmingResign(false);
  }, [game.gameState.turnNumber]);

  const isThinking = game.uiPhase.phase === 'cpu-thinking';

  return (
    <div className={styles.app}>
      <Header
        gameState={game.gameState}
        gameMode={game.gameMode}
        cpuColor={game.cpuColor}
        difficulty={game.difficulty}
      />

      <main className={styles.main}>
        <Board
          gameState={game.gameState}
          uiPhase={game.uiPhase}
          validPlaceCells={validPlaceCells}
          onCellClick={game.clickCell}
          onStackClick={game.selectStack}
          className={isThinking ? styles.thinking : undefined}
        />

        {!reviewing && (
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
        )}

        {!reviewing && game.canResign && (
          <div className={styles.resignArea}>
            {confirmingResign ? (
              <>
                <button
                  className={styles.confirmResignButton}
                  onClick={() => {
                    game.resign();
                    setConfirmingResign(false);
                  }}
                >
                  Confirm resign
                </button>
                <button
                  className={styles.cancelResignButton}
                  onClick={() => setConfirmingResign(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button className={styles.resignButton} onClick={() => setConfirmingResign(true)}>
                Resign
              </button>
            )}
          </div>
        )}

        <MoveHistory
          moves={game.gameState.moveHistory}
          size={game.gameState.size}
          rightSlot={
            reviewing ? (
              <button
                className={styles.newGameButton}
                onClick={() => {
                  setReviewing(false);
                  setShowSetup(true);
                }}
              >
                New game
              </button>
            ) : (
              <button
                className={styles.undoButton}
                onClick={game.undo}
                disabled={!game.canUndo}
                aria-label="Undo last move"
              >
                ↩ Undo
              </button>
            )
          }
        />
      </main>

      {game.gameState.result && !reviewing && (
        <GameOverlay
          result={game.gameState.result}
          onPlayAgain={() => setShowSetup(true)}
          onReview={() => setReviewing(true)}
        />
      )}

      {showSetup && (
        <GameSetup
          savedGame={savedGame}
          onResume={() => {
            if (savedGame) {
              game.resumeGame(savedGame);
              setSavedGame(null);
              setReviewing(false);
              setShowSetup(false);
            }
          }}
          onStart={(opts) => {
            game.startGame(opts);
            setSavedGame(null);
            setReviewing(false);
            setShowSetup(false);
          }}
        />
      )}
    </div>
  );
}
