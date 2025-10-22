import { useState, useEffect, useMemo, useRef } from 'react';
import * as onlineService from '../services/onlineService';
import type { OnlineGame, BoardState, Player } from '../types';
import type { User } from 'firebase/auth';
import { TURN_TIME, INITIAL_GAME_TIME } from '../constants';

export const useOnlineGame = (
  onlineGameId: string | null,
  user: User | null
) => {
  const [onlineGame, setOnlineGame] = useState<OnlineGame | null>(null);
  const [board, setBoard] = useState<BoardState>(() =>
    onlineService.mapToBoard({})
  );
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const lastProcessedEmoteTimestampRef = useRef<number>(0);
  const [opponentEmote, setOpponentEmote] = useState<{
    key: number;
    emoji: string;
  } | null>(null);
  const [turnTimeLeft, setTurnTimeLeft] = useState(TURN_TIME);
  const [activePlayerTime, setActivePlayerTime] = useState(INITIAL_GAME_TIME);

  const playerMark = useMemo<Player>(() => {
    if (onlineGame && user) {
      return onlineGame.players.X === user.uid ? 'X' : 'O';
    }
    return 'X';
  }, [onlineGame, user]);

  // Main listener for game state from Firestore
  useEffect(() => {
    if (!onlineGameId || !user) {
      setIsLoading(false);
      setOnlineGame(null);
      return;
    }
    setIsLoading(true);

    const unsubscribe = onlineService.getOnlineGameStream(
      onlineGameId,
      (game) => {
        if (game) {
          setOnlineGame(game);

          // Emote handling
          if (game.emotes && user) {
            const { uid, emoji, timestamp } = game.emotes;
            if (
              uid !== user.uid &&
              timestamp > lastProcessedEmoteTimestampRef.current
            ) {
              lastProcessedEmoteTimestampRef.current = timestamp;
              setOpponentEmote({ key: timestamp, emoji });
            }
          }

          // Board update handling
          setBoard((prevBoard) => {
            const newBoard = onlineService.mapToBoard(game.board);
            if (JSON.stringify(prevBoard) !== JSON.stringify(newBoard)) {
              setLastMove(onlineService.getLastMove(prevBoard, newBoard));
            }
            return newBoard;
          });
        } else {
          setOnlineGame(null);
        }
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [onlineGameId, user]);

  // Timer and timeout detection logic
  useEffect(() => {
    if (!onlineGame || onlineGame.status === 'finished') {
      setTurnTimeLeft(TURN_TIME);
      const lastPlayer = onlineGame?.currentPlayer || 'X';
      setActivePlayerTime(
        onlineGame?.playerTimes?.[lastPlayer] ?? INITIAL_GAME_TIME
      );
      return;
    }

    const timerId = setInterval(() => {
      // This part for the progress bar
      const turnElapsed = (Date.now() - onlineGame.turnStartedAt) / 1000;
      const turnRemaining = TURN_TIME - turnElapsed;
      setTurnTimeLeft(turnRemaining);

      // This part for the main digital clock
      const currentPlayer = onlineGame.currentPlayer;
      const timeBank = onlineGame.playerTimes[currentPlayer];
      const remainingInBank = timeBank - turnElapsed;
      setActivePlayerTime(Math.max(0, remainingInBank));

      // Timeout claim logic
      if (
        remainingInBank < -2 &&
        onlineGame.currentPlayer !== playerMark &&
        user
      ) {
        onlineService.claimTimeoutVictory(onlineGame.id, playerMark);
      }
    }, 500);

    return () => clearInterval(timerId);
  }, [onlineGame, playerMark, user]);

  return {
    // Game state
    board,
    currentPlayer: onlineGame?.currentPlayer || null,
    winner: onlineGame?.winner || null,
    isGameOver: onlineGame?.status === 'finished',
    winningLine: onlineGame?.winningLine || [],

    // Meta state
    isDecidingFirst: false,
    isLoading,
    onlineGameData: onlineGame,
    lastMove,
    opponentEmote,

    // Info
    playerMark,
    gameId: onlineGame?.id || null,
    activePlayerTime,
    turnTimeLeft,

    // Actions
    makeMove: (row: number, col: number) => {
      if (onlineGameId) {
        onlineService.makeOnlineMove(onlineGameId, row, col, playerMark);
      }
    },
    resign: () => {
      if (onlineGameId) {
        onlineService.resignOnlineGame(onlineGameId, playerMark);
      }
    },
    sendEmote: (emoji: string) => {
      if (onlineGameId && user) {
        onlineService.sendOnlineEmote(onlineGameId, user.uid, emoji);
      }
    },
    // No-op functions to match useGameLogic signature where not applicable
    beginGame: () => {},
    resetGameForRematch: () => {},
    undoMove: () => {},
    canUndo: false,
    moveHistory: [],
  };
};
