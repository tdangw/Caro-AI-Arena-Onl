import React from 'react';
import type { Player, BoardState, GameTheme, PieceStyle, PieceEffect } from '../../types';

interface GameCellProps {
  state: Player | null;
  onClick: () => void;
  isWinningCell: boolean;
  pieces: { X: PieceStyle; O: PieceStyle };
  showThinkingIndicator: boolean;
  theme: GameTheme;
  playPlacementEffect: boolean;
  isLastMove: boolean;
  effect: PieceEffect;
}

const GameCell: React.FC<GameCellProps> = React.memo(({ state, onClick, isWinningCell, pieces, showThinkingIndicator, theme, playPlacementEffect, isLastMove, effect }) => {
  const PieceX = pieces.X.component;
  const PieceO = pieces.O.component;
  const effectIdClass = `animate-effect_${effect.id.split('_')[1]}`;

  return (
    <div
      className={`w-full h-full flex items-center justify-center cursor-pointer group relative`}
      onClick={onClick}
      style={{ '--tw-bg-opacity': 0.1 } as React.CSSProperties}
    >
      <div className={`absolute inset-0 border-r border-b ${theme.gridColor}`}></div>
      {state === null && <div className={`absolute inset-0 opacity-0 group-hover:bg-white/10 transition-colors duration-200 rounded-sm`}></div>}

      <div className={`w-full h-full relative transition-all duration-200 ${isWinningCell ? 'bg-yellow-500/30 rounded-md scale-110' : ''}`}>
        {state && (
          <div className={`w-full h-full p-1.5`}>
            <div className={`relative w-full h-full ${state === 'X' ? 'text-cyan-400' : 'text-pink-500'}`}>
              <div className={playPlacementEffect ? effectIdClass : ''}>
                <div className={isLastMove ? 'last-move-highlight' : ''}>
                  {state === 'X' ? <PieceX /> : <PieceO />}
                </div>
              </div>
            </div>
          </div>
        )}
        {showThinkingIndicator && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
});

interface GameBoardProps {
  board: BoardState;
  onCellClick: (row: number, col: number) => void;
  winningLine: { row: number; col: number }[];
  pieces: { X: PieceStyle; O: PieceStyle };
  aiThinkingCell: { row: number; col: number } | null;
  theme: GameTheme;
  lastMove: { row: number; col: number } | null;
  effect: PieceEffect;
}

const GameBoard: React.FC<GameBoardProps> = ({ board, onCellClick, winningLine, pieces, aiThinkingCell, theme, lastMove, effect }) => {
  const isWinningCell = (row: number, col: number) => winningLine.some(cell => cell.row === row && cell.col === col);

  return (
    <div
      className={`grid ${theme.cellBg} border-t border-l ${theme.gridColor}`}
      style={{ gridTemplateColumns: `repeat(${board.length}, minmax(0, 1fr))` }}
    >
      {board.map((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <div key={`${rowIndex}-${colIndex}`} className="aspect-square">
            <GameCell
              state={cell}
              onClick={() => onCellClick(rowIndex, colIndex)}
              isWinningCell={isWinningCell(rowIndex, colIndex)}
              pieces={pieces}
              showThinkingIndicator={aiThinkingCell?.row === rowIndex && aiThinkingCell?.col === colIndex}
              theme={theme}
              playPlacementEffect={lastMove?.row === rowIndex && lastMove?.col === colIndex}
              isLastMove={lastMove?.row === rowIndex && lastMove?.col === colIndex}
              effect={effect}
            />
          </div>
        ))
      )}
    </div>
  );
};

export default GameBoard;