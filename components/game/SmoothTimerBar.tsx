import React, { useState, useEffect, useRef } from 'react';
import type { Player } from '../../types';
import { TURN_TIME } from '../../constants';

interface SmoothTimerBarProps {
  currentPlayer: Player | null;
  isPaused: boolean;
  isGameOver: boolean;
  isDecidingFirst: boolean;
}

const SmoothTimerBar: React.FC<SmoothTimerBarProps> = React.memo(({ currentPlayer, isPaused, isGameOver, isDecidingFirst }) => {
  const [visualTime, setVisualTime] = useState(TURN_TIME);
  // FIX: Explicitly initialize useRef with null for better type safety.
  const animationFrameRef = useRef<number | null>(null);
  const turnStartTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const lastPlayerRef = useRef<Player | null>(null);

  useEffect(() => {
    if (currentPlayer !== lastPlayerRef.current || isDecidingFirst) {
      turnStartTimeRef.current = Date.now();
      pauseTimeRef.current = 0;
      setVisualTime(TURN_TIME);
      lastPlayerRef.current = currentPlayer;
    }
  }, [currentPlayer, isDecidingFirst]);

  useEffect(() => {
    if (isPaused && pauseTimeRef.current === 0) {
      pauseTimeRef.current = Date.now();
    } else if (!isPaused && pauseTimeRef.current > 0) {
      const pauseDuration = Date.now() - pauseTimeRef.current;
      turnStartTimeRef.current += pauseDuration;
      pauseTimeRef.current = 0;
    }
  }, [isPaused]);

  useEffect(() => {
    const animate = () => {
      if (!isPaused && !isGameOver && !isDecidingFirst && currentPlayer) {
        const elapsed = Date.now() - turnStartTimeRef.current;
        const remaining = Math.max(0, TURN_TIME - elapsed / 1000);
        setVisualTime(remaining);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentPlayer, isPaused, isGameOver, isDecidingFirst]);

  const shouldAnimate = !isGameOver && !isDecidingFirst && !isPaused && currentPlayer;
  const percentage = (visualTime / TURN_TIME) * 100;
  const timeBarColor = percentage < 30 ? 'bg-red-500' : percentage < 70 ? 'bg-yellow-400' : 'bg-green-400';

  return (
    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full ${timeBarColor} rounded-full`}
        style={{
          width: `${percentage}%`,
          transition: shouldAnimate ? 'none' : 'width 0.3s ease-in-out',
        }}
      ></div>
    </div>
  );
});

export default SmoothTimerBar;