import React, { useState, useEffect } from 'react';
import type { Player, PieceStyle } from '../../types';
import type { SoundEffect } from '../../hooks/useSound';

interface FirstMoveAnimationProps {
  pieces: { X: PieceStyle; O: PieceStyle };
  onAnimationEnd: (firstPlayer: Player) => void;
  playerMark: Player;
  playSound: (sound: SoundEffect) => void;
  // New props for online mode
  gameMode?: 'pve' | 'online';
  forcedWinner?: Player | null;
  playerInfo?: { name: string };
  opponentInfo?: { name: string };
}

const FirstMoveAnimation: React.FC<FirstMoveAnimationProps> = ({ pieces, onAnimationEnd, playerMark, playSound, gameMode = 'pve', forcedWinner = null, playerInfo, opponentInfo }) => {
  const [winner, setWinner] = useState<Player | null>(null);
  const [firstPlayer] = useState<Player>(() => forcedWinner || (Math.random() < 0.5 ? 'X' : 'O'));
  const PieceX = pieces.X.component;
  const PieceO = pieces.O.component;

  useEffect(() => {
    playSound('deciding');
    const timer = setTimeout(() => {
      setWinner(firstPlayer);
      if (gameMode === 'pve') {
        playSound(firstPlayer === playerMark ? 'first_move_player' : 'first_move_ai');
      } else {
        playSound('check');
      }
      setTimeout(() => onAnimationEnd(firstPlayer), 1500);
    }, 1500);
    return () => clearTimeout(timer);
  }, [firstPlayer, onAnimationEnd, playerMark, playSound, gameMode]);

  const getWinnerText = () => {
      if (!winner) return 'Deciding who goes first...';
      const winnerName = winner === playerMark ? playerInfo?.name : opponentInfo?.name;
      return `${winnerName} goes first!`;
  }

  return (
    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center rounded-lg z-20">
      <div className="relative w-48 h-24">
        <div
          className={`absolute top-0 w-24 h-24 p-2 transition-all duration-500 ease-out ${
            winner ? (winner === 'X' ? 'left-1/2 -translate-x-1/2 scale-125' : 'left-0 opacity-0 -translate-x-full') : 'left-0 animate-slide-in-left'
          }`}
        >
          <PieceX className="text-cyan-400" />
        </div>
        <div
          className={`absolute top-0 w-24 h-24 p-2 transition-all duration-500 ease-out ${
            winner ? (winner === 'O' ? 'left-1/2 -translate-x-1/2 scale-125' : 'right-0 opacity-0 translate-x-full') : 'right-0 animate-slide-in-right'
          }`}
        >
          <PieceO className="text-pink-500" />
        </div>
      </div>
      <p className="text-white font-semibold text-lg mt-4 transition-opacity duration-300">
        {getWinnerText()}
      </p>
      <style>{`
        @keyframes slide-in-left { 0% { transform: translateX(-100vw); } 80% { transform: translateX(0); } 100% { transform: translateX(0); }}
        @keyframes slide-in-right { 0% { transform: translateX(100vw); } 80% { transform: translateX(0); } 100% { transform: translateX(0); }}
        .animate-slide-in-left { animation: slide-in-left 1s cubic-bezier(0.25, 1, 0.5, 1); }
        .animate-slide-in-right { animation: slide-in-right 1s cubic-bezier(0.25, 1, 0.5, 1); }
      `}</style>
    </div>
  );
};

export default FirstMoveAnimation;