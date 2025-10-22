import { useState, useEffect, useMemo, useRef } from 'react';
import * as onlineService from '../services/onlineService';
import type { OnlineGame, BoardState, Player } from '../types';
import type { User } from 'firebase/auth';

export const useOnlineGame = (onlineGameId: string | null, user: User | null) => {
    const [onlineGame, setOnlineGame] = useState<OnlineGame | null>(null);
    const [board, setBoard] = useState<BoardState>(() => onlineService.mapToBoard({}));
    const [lastMove, setLastMove] = useState<{ row: number, col: number } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const lastProcessedEmoteTimestampRef = useRef<number>(0);
    const [opponentEmote, setOpponentEmote] = useState<{ key: number, emoji: string } | null>(null);

    const playerMark = useMemo<Player>(() => {
        if (onlineGame && user) {
            return onlineGame.players.X === user.uid ? 'X' : 'O';
        }
        return 'X'; // Default, will be quickly corrected
    }, [onlineGame, user]);

    useEffect(() => {
        if (!onlineGameId || !user) {
            setIsLoading(false);
            setOnlineGame(null);
            return;
        }
        setIsLoading(true);

        const unsubscribe = onlineService.getOnlineGameStream(onlineGameId, (game) => {
            if (game) {
                setOnlineGame(game);

                // Emote handling
                if (game.emotes && user) {
                    const { uid, emoji, timestamp } = game.emotes;
                    if (uid !== user.uid && timestamp > lastProcessedEmoteTimestampRef.current) {
                        lastProcessedEmoteTimestampRef.current = timestamp;
                        setOpponentEmote({ key: timestamp, emoji });
                    }
                }

                // Board update handling
                setBoard(prevBoard => {
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
        });

        return () => unsubscribe();
    }, [onlineGameId, user]);

    return {
        // Game state
        board,
        currentPlayer: onlineGame?.currentPlayer || null,
        winner: onlineGame?.winner || null,
        isGameOver: onlineGame?.status === 'finished',
        winningLine: onlineGame?.winningLine || [],
        
        // Meta state
        isDecidingFirst: false, // Online games decide this before component mounts
        isLoading,
        onlineGameData: onlineGame, // Pass the raw data for rematch UI, etc.
        lastMove,
        opponentEmote,
        
        // Info
        playerMark,
        gameId: onlineGame?.id || null,
        totalGameTime: 900, // Placeholder, can be dynamic later

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