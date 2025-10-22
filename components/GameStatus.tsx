import React from 'react';
import type { GameStatus, Player, GameMode } from '../types';

interface GameStatusProps {
    status: GameStatus;
    winner: Player | null;
    currentPlayer: Player;
    isAiThinking: boolean;
    gameMode: GameMode;
    playerMark: Player;
    opponentName: string;
}

const GameStatusDisplay: React.FC<GameStatusProps> = ({ status, winner, currentPlayer, isAiThinking, gameMode, playerMark, opponentName }) => {
    let message: string | React.ReactNode = '';
    let messageColor = "text-slate-300";

    if (isAiThinking && gameMode === 'pve') {
        message = (
            <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
                <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                <span>{opponentName} is thinking...</span>
            </div>
        );
        messageColor = "text-purple-400";
    } else if (status === 'win') {
        if (winner === playerMark) {
            message = 'Congratulations, You Win!';
            messageColor = "text-cyan-400";
        } else {
            message = `${opponentName} Wins! Better luck next time.`;
            messageColor = "text-purple-500";
        }
    } else if (status === 'draw') {
        message = 'The game is a Draw!';
        messageColor = "text-yellow-400";
    } else if (currentPlayer) {
        if (currentPlayer === playerMark) {
            message = `Your Turn (${playerMark})`;
            messageColor = "text-cyan-400";
        } else {
            message = `${opponentName}'s Turn (${currentPlayer})`;
            messageColor = "text-purple-400";
        }
    }

    return (
        <div className="h-12 flex items-center justify-center my-4">
            <p className={`text-xl md:text-2xl font-semibold transition-colors duration-300 ${messageColor}`}>
                {message}
            </p>
        </div>
    );
};

export default GameStatusDisplay;