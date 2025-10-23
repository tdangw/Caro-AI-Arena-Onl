
import React from 'react';
import Cell from './Cell';
// FIX: Changed Board to BoardState and imported Coordinate.
// FIX: The 'Coordinate' type is not exported from '../types'. Replaced it with an inline type definition and removed it from the import.
import type { BoardState } from '../types';

interface GameBoardProps {
    // FIX: Changed Board to BoardState.
    board: BoardState;
    onCellClick: (row: number, col: number) => void;
    winningLine: { row: number; col: number }[];
    isGameActive: boolean;
}

const GameBoard: React.FC<GameBoardProps> = ({ board, onCellClick, winningLine, isGameActive }) => {
    const isWinningCell = (row: number, col: number) => {
        return winningLine.some(coord => coord.row === row && coord.col === col);
    };

    return (
        <div className="bg-slate-900 p-2 md:p-4 rounded-lg shadow-2xl border border-slate-700">
            <div className="grid grid-cols-15 gap-1">
                {board.map((row, rowIndex) => (
                     row.map((cell, colIndex) => (
                        <Cell
                            key={`${rowIndex}-${colIndex}`}
                            value={cell}
                            onClick={() => onCellClick(rowIndex, colIndex)}
                            isWinningCell={isWinningCell(rowIndex, colIndex)}
                            isDisabled={!isGameActive}
                        />
                    ))
                ))}
            </div>
        </div>
    );
};

export default GameBoard;