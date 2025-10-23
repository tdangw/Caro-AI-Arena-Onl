import React from 'react';
import type { Player } from '../../types';

interface SmoothTimerBarProps {
  duration: number;
  isPaused: boolean;
  isGameOver: boolean;
  isDecidingFirst: boolean;
  time: number;
}

const SmoothTimerBar: React.FC<SmoothTimerBarProps> = React.memo(({ duration, isPaused, isGameOver, isDecidingFirst, time }) => {
  // If game is over or not started, show a full bar.
  if (isGameOver || isDecidingFirst) {
    return (
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-green-400 rounded-full" style={{ width: '100%' }}></div>
        </div>
    );
  }

  const percentage = Math.max(0, (time / duration) * 100);
  const timeBarColor = percentage < 30 ? 'bg-red-500' : percentage < 70 ? 'bg-yellow-400' : 'bg-green-400';

  return (
    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full ${timeBarColor} rounded-full transition-colors duration-500`}
        style={{
          width: `${percentage}%`,
          transition: isPaused ? 'none' : 'width 0.5s linear',
        }}
      ></div>
    </div>
  );
});

export default SmoothTimerBar;