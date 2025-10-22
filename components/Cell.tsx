
import React from 'react';
// FIX: Changed CellValue to CellState as defined in types.ts.
import type { CellState } from '../types';

interface CellProps {
    // FIX: Changed CellValue to CellState.
    value: CellState;
    onClick: () => void;
    isWinningCell: boolean;
    isDisabled: boolean;
}

const Cell: React.FC<CellProps> = ({ value, onClick, isWinningCell, isDisabled }) => {
    const baseStyle = "w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-md transition-all duration-200";
    const emptyStyle = "bg-slate-800 hover:bg-slate-700 cursor-pointer";
    const filledStyle = "cursor-not-allowed";
    const winningStyle = isWinningCell ? "bg-green-500 shadow-lg scale-110" : "";

    const playerXStyle = "text-cyan-400 font-bold text-2xl md:text-3xl";
    const playerOStyle = "text-purple-400 font-bold text-2xl md:text-3xl";

    return (
        <div 
            onClick={!value && !isDisabled ? onClick : undefined}
            className={`${baseStyle} ${value ? filledStyle : (isDisabled ? 'cursor-wait' : emptyStyle)} ${winningStyle}`}
        >
            <span className={value === 'X' ? playerXStyle : playerOStyle}>
                {value}
            </span>
        </div>
    );
};

export default Cell;