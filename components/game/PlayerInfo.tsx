import React from 'react';
import type { Player, PieceStyle } from '../../types';

interface PlayerInfoProps {
  name: string;
  avatar: string;
  level: number;
  player: Player;
  align: 'left' | 'right';
  isCurrent: boolean;
  piece: PieceStyle;
  skillLevel?: 'easy' | 'medium' | 'hard';
}

const PlayerInfo = React.forwardRef<HTMLDivElement, PlayerInfoProps>(({ name, avatar, level, player, align, isCurrent, piece, skillLevel }, ref) => {
  const PieceComponent = piece.component;
  const glowClass = isCurrent ? 'shadow-lg shadow-yellow-500/50' : '';
  const colorClass = player === 'X' ? 'text-cyan-400' : 'text-pink-500';

  const borderColorMap = {
    easy: 'border-green-500',
    medium: 'border-purple-500',
    hard: 'border-orange-500',
  };
  const borderColor = skillLevel ? borderColorMap[skillLevel] : '';

  return (
    <div ref={ref} className={`flex items-center gap-3 relative ${align === 'right' ? 'flex-row-reverse' : ''}`}>
      <img src={avatar} alt={`${name}'s avatar`} className={`w-14 h-14 rounded-full transition-all duration-300 ${glowClass} bg-slate-700 object-cover ${skillLevel ? `border-2 ${borderColor}` : ''}`} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }} />
      <div className={`${align === 'right' ? 'text-right' : ''} text-shadow`}>
        <h3 className="font-bold text-white text-lg">{name}</h3>
        <div className={`flex items-center gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
          <p className="text-slate-300 text-sm">Lv. {level}</p>
          <div className={`w-5 h-5 ${colorClass}`}><PieceComponent /></div>
        </div>
      </div>
    </div>
  );
});

export default PlayerInfo;