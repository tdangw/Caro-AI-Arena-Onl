import { useState, useCallback, useEffect, useRef } from 'react';
import type { BoardState, Player } from '../types';
import {
  BOARD_SIZE,
  WINNING_LENGTH,
  INITIAL_GAME_TIME,
  TURN_TIME,
} from '../constants';

const IN_PROGRESS_GAME_KEY = 'caroGameState_inProgress';

const createEmptyBoard = (): BoardState => {
  return Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null));
};

const loadInitialState = () => {
  try {
    const savedState = localStorage.getItem(IN_PROGRESS_GAME_KEY);
    if (savedState) {
      const { board, currentPlayer, totalGameTime } = JSON.parse(savedState);
      if (
        board &&
        Array.isArray(board) &&
        currentPlayer &&
        typeof totalGameTime === 'number'
      ) {
        if (board.length === BOARD_SIZE && board[0]?.length === BOARD_SIZE) {
          return {
            board,
            currentPlayer,
            totalGameTime,
            isDecidingFirst: false,
          };
        }
      }
    }
  } catch (error) {
    console.error('Failed to load game state from localStorage', error);
    localStorage.removeItem(IN_PROGRESS_GAME_KEY);
  }
  return {
    board: createEmptyBoard(),
    currentPlayer: null,
    totalGameTime: INITIAL_GAME_TIME,
    isDecidingFirst: true,
  };
};

export const useGameLogic = (
  playerMark: Player = 'X',
  isPaused: boolean = false
) => {
  const [initialState] = useState(loadInitialState);

  const [board, setBoard] = useState<BoardState>(initialState.board);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(
    initialState.currentPlayer
  );
  const [winner, setWinner] = useState<Player | null | 'draw' | 'timeout'>(
    null
  );
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [winningLine, setWinningLine] = useState<
    { row: number; col: number }[]
  >([]);
  const [isDecidingFirst, setIsDecidingFirst] = useState(
    initialState.isDecidingFirst
  );
  const [totalGameTime, setTotalGameTime] = useState(
    initialState.totalGameTime
  );
  const [turnTimeLeft, setTurnTimeLeft] = useState(TURN_TIME);
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | null>(
    null
  );

  const historyRef = useRef<
    { board: BoardState; currentPlayer: Player | null; totalGameTime: number }[]
  >([]);
  const moveHistoryRef = useRef<{ row: number; col: number }[]>([]);
  const turnTimerIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalGameTimerIdRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  useEffect(() => {
    if (!isGameOver && !isDecidingFirst && currentPlayer) {
      try {
        const gameState = { board, currentPlayer, totalGameTime };
        localStorage.setItem(IN_PROGRESS_GAME_KEY, JSON.stringify(gameState));
      } catch (error) {
        console.error('Failed to save game state:', error);
      }
    } else {
      localStorage.removeItem(IN_PROGRESS_GAME_KEY);
    }
  }, [board, currentPlayer, totalGameTime, isGameOver, isDecidingFirst]);

  const stopTimers = useCallback(() => {
    if (turnTimerIdRef.current) {
      clearInterval(turnTimerIdRef.current);
      turnTimerIdRef.current = null;
    }
    if (totalGameTimerIdRef.current) {
      clearInterval(totalGameTimerIdRef.current);
      totalGameTimerIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isGameOver || isDecidingFirst || !currentPlayer || isPaused) {
      stopTimers();
      return;
    }

    setTurnTimeLeft(TURN_TIME);

    turnTimerIdRef.current = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimers();
          setWinner('timeout');
          setIsGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    totalGameTimerIdRef.current = setInterval(() => {
      setTotalGameTime((prev) => {
        if (prev <= 1) {
          stopTimers();
          setWinner('draw'); // Total game time running out is a draw
          setIsGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => stopTimers();
  }, [isGameOver, isDecidingFirst, currentPlayer, isPaused, stopTimers]);

  const checkWin = useCallback(
    (
      currentBoard: BoardState,
      player: Player
    ): { row: number; col: number }[] | null => {
      const directions = [
        { r: 0, c: 1 },
        { r: 1, c: 0 },
        { r: 1, c: 1 },
        { r: 1, c: -1 },
      ];
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (currentBoard[r][c] === player) {
            for (const dir of directions) {
              const line = [];
              let win = true;
              for (let i = 0; i < WINNING_LENGTH; i++) {
                const newR = r + i * dir.r;
                const newC = c + i * dir.c;
                if (
                  newR < 0 ||
                  newR >= BOARD_SIZE ||
                  newC < 0 ||
                  newC >= BOARD_SIZE ||
                  currentBoard[newR][newC] !== player
                ) {
                  win = false;
                  break;
                }
                line.push({ row: newR, col: newC });
              }
              if (win) return line;
            }
          }
        }
      }
      return null;
    },
    []
  );

  const isBoardFull = (currentBoard: BoardState) => {
    return currentBoard.every((row) => row.every((cell) => cell !== null));
  };

  const makeMove = useCallback(
    (row: number, col: number) => {
      if (!currentPlayer || board[row][col] || isGameOver || isDecidingFirst)
        return;

      historyRef.current.push({ board, currentPlayer, totalGameTime });
      moveHistoryRef.current.push({ row, col });
      setLastMove({ row, col });

      const newBoard = board.map((r) => [...r]);
      newBoard[row][col] = currentPlayer;
      setBoard(newBoard);

      const winCheck = checkWin(newBoard, currentPlayer);
      if (winCheck) {
        setWinner(currentPlayer);
        setIsGameOver(true);
        setWinningLine(winCheck);
      } else if (isBoardFull(newBoard)) {
        setWinner('draw');
        setIsGameOver(true);
      } else {
        setCurrentPlayer((prev) => (prev === 'X' ? 'O' : 'X'));
      }
    },
    [board, currentPlayer, isGameOver, checkWin, isDecidingFirst, totalGameTime]
  );

  const resetGameForRematch = useCallback(() => {
    stopTimers();
    setBoard(createEmptyBoard());
    setWinner(null);
    setIsGameOver(false);
    setWinningLine([]);
    setTotalGameTime(INITIAL_GAME_TIME);
    setTurnTimeLeft(TURN_TIME);
    setCurrentPlayer(null);
    setIsDecidingFirst(true);
    historyRef.current = [];
    moveHistoryRef.current = [];
    setLastMove(null);
    localStorage.removeItem(IN_PROGRESS_GAME_KEY);
  }, [stopTimers]);

  const beginGame = useCallback((firstPlayer: Player) => {
    setCurrentPlayer(firstPlayer);
    setIsDecidingFirst(false);
  }, []);

  const canUndo =
    currentPlayer === playerMark &&
    !isGameOver &&
    historyRef.current.length > 0;

  const undoMove = useCallback(() => {
    if (!canUndo) return;

    const stateBeforePlayerMove =
      historyRef.current[historyRef.current.length - 2];

    if (stateBeforePlayerMove) {
      historyRef.current.pop();
      historyRef.current.pop();
      moveHistoryRef.current.pop();
      moveHistoryRef.current.pop();
      setBoard(stateBeforePlayerMove.board);
      setCurrentPlayer(stateBeforePlayerMove.currentPlayer);
      setTotalGameTime(stateBeforePlayerMove.totalGameTime);
    } else if (historyRef.current.length === 1) {
      const initialGameState = historyRef.current.pop();
      moveHistoryRef.current.pop();
      if (initialGameState) {
        setBoard(initialGameState.board);
        setCurrentPlayer(initialGameState.currentPlayer);
        setTotalGameTime(initialGameState.totalGameTime);
      }
    }

    setLastMove(
      moveHistoryRef.current[moveHistoryRef.current.length - 1] || null
    );

    setWinner(null);
    setIsGameOver(false);
    setWinningLine([]);
    stopTimers();
  }, [canUndo, stopTimers]);

  const resign = () => {
    if (!currentPlayer || isGameOver) return;
    setWinner(currentPlayer === playerMark ? 'O' : 'X');
    setIsGameOver(true);
  };

  return {
    board,
    currentPlayer,
    winner,
    isGameOver,
    makeMove,
    resetGameForRematch,
    beginGame,
    winningLine,
    isDecidingFirst,
    totalGameTime,
    turnTimeLeft,
    resign,
    undoMove,
    canUndo,
    moveHistory: moveHistoryRef.current,
    gameId: null,
    playerMark,
    lastMove,
  };
};
