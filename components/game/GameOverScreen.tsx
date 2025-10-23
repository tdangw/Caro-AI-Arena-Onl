import React, { useEffect, useState, useMemo } from 'react';
import type { Player, GameMode, OnlineGame } from '@/types';
import { COIN_REWARD, XP_REWARD, getXpForNextLevel } from '@/constants';

// --- Helper Hooks and Functions ---
const useAnimatedCounter = (endValue: number, start: boolean, duration = 1200) => {
    const [count, setCount] = useState(0);
    const frameRef = React.useRef<number | null>(null);

    useEffect(() => {
        if (start) {
            let startTimestamp: number | null = null;
            const step = (timestamp: number) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                setCount(Math.floor(progress * endValue));
                if (progress < 1) {
                    frameRef.current = requestAnimationFrame(step);
                }
            };
            frameRef.current = requestAnimationFrame(step);
        } else {
             setCount(0);
        }
        return () => {
             if(frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [endValue, duration, start]);
    return count;
};

interface GameOverScreenProps {
  show: boolean;
  winner: Player | 'draw' | 'timeout' | null;
  timedOutPlayer: Player | null;
  playerMark: Player;
  onReset: () => void;
  onExit: () => void;
  playerLevel: number;
  playerXp: number;
  gameMode: GameMode;
  onlineGame?: OnlineGame | null;
  // FIX: Added onRematch to handle online game rematches.
  onRematch?: (newGameId: string) => void;
  leaveCountdown?: number;
  cpChange?: number;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({show, winner, timedOutPlayer, playerMark, onReset, onExit, playerLevel, playerXp, gameMode, onlineGame, leaveCountdown, cpChange = 0}) => {
    const [animationStage, setAnimationStage] = useState<'start' | 'filling' | 'levelUp' | 'done'>('start');
    const [displayLevel, setDisplayLevel] = useState(playerLevel);

    const isWin = winner === playerMark;
    const isDraw = winner === 'draw';
    const didPlayerTimeout = timedOutPlayer === playerMark;
    
    const outcome = didPlayerTimeout ? 'loss' : isWin ? 'win' : isDraw ? 'draw' : 'loss';
    const xpEarned = show ? XP_REWARD[outcome] : 0;
    const coinsEarned = show ? COIN_REWARD[outcome] : 0;
    
    const { didLevelUp, initialLevel, initialXp, newLevel, finalXp } = useMemo(() => {
        if (!show) {
            return { didLevelUp: false, initialLevel: playerLevel, initialXp: playerXp, newLevel: playerLevel, finalXp: playerXp };
        }
        
        let finalTotalXp = playerXp;
        for (let i = 1; i < playerLevel; i++) {
            finalTotalXp += getXpForNextLevel(i);
        }

        const initialTotalXp = finalTotalXp - xpEarned;

        let initialLevelCalc = 1;
        let initialXpCalc = initialTotalXp;
        let xpForNext = getXpForNextLevel(initialLevelCalc);
        
        while (initialXpCalc >= xpForNext) {
            initialXpCalc -= xpForNext;
            initialLevelCalc++;
            xpForNext = getXpForNextLevel(initialLevelCalc);
        }

        return {
            didLevelUp: initialLevelCalc < playerLevel,
            initialLevel: initialLevelCalc,
            initialXp: initialXpCalc,
            newLevel: playerLevel,
            finalXp: playerXp
        };
    }, [show, playerLevel, playerXp, xpEarned]);


    const initialXpPercent = (initialXp / getXpForNextLevel(initialLevel)) * 100;
    const finalXpPercent = didLevelUp ? 100 : ((initialXp + xpEarned) / getXpForNextLevel(initialLevel)) * 100;
    const newLevelXpPercent = (finalXp / getXpForNextLevel(newLevel)) * 100;
    
    const animatedCoins = useAnimatedCounter(coinsEarned, animationStage !== 'start');
    const animatedXp = useAnimatedCounter(xpEarned, animationStage !== 'start');
    const animatedCpChange = useAnimatedCounter(cpChange, animationStage !== 'start');

    const title = useMemo(() => {
        if (winner === 'timeout') return didPlayerTimeout ? "TIME'S UP!" : "OPPONENT TIMED OUT";
        if (isWin) return "YOU WIN!";
        if (isDraw) return "IT'S A DRAW!";
        return "YOU LOSE!";
    }, [winner, didPlayerTimeout, isWin, isDraw]);
    
    const gameDuration = useMemo(() => {
        if (!show || !onlineGame) return null;
        const durationSeconds = Math.round((Date.now() - onlineGame.createdAt) / 1000);
        if (durationSeconds < 0) return null;
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;
        return `${minutes}m ${seconds}s`;
    }, [show, onlineGame]);

    const titleColor = outcome === 'win' ? "text-green-400" : outcome === 'draw' ? "text-yellow-400" : "text-red-500";
    
    // This effect handles the summary screen animations.
    useEffect(() => {
        let animationTimer: ReturnType<typeof setTimeout> | null = null;
        if (show) {
            setDisplayLevel(initialLevel);
            animationTimer = setTimeout(() => {
              setAnimationStage('filling');
              if (didLevelUp) {
                setTimeout(() => setAnimationStage('levelUp'), 1200);
                setTimeout(() => {
                  setDisplayLevel(newLevel);
                  setAnimationStage('done');
                }, 1700);
              } else {
                setTimeout(() => setAnimationStage('done'), 1200);
              }
            }, 500);

            return () => {
                if(animationTimer) clearTimeout(animationTimer);
            };
        } else {
            setAnimationStage('start');
            setDisplayLevel(playerLevel);
        }
    }, [show, didLevelUp, newLevel, initialLevel, playerLevel]);

    return (
        <div className={`fixed inset-0 bg-black/80 flex items-center justify-center z-40 transition-opacity duration-500 ${show ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className={`text-center transition-all duration-500 ${show ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                <h1 className={`text-6xl font-black ${titleColor} mb-6`}>{title}</h1>
                
                <div className="bg-slate-800 rounded-xl p-6 w-80 mx-auto border border-slate-700 relative">
                    <div className="text-left mb-4">
                        <div className="flex justify-between items-baseline mb-1">
                            <span className="font-semibold text-white">Level {displayLevel}</span>
                             <span className={`text-sm bg-pink-500 text-white font-bold px-2 py-0.5 rounded-full transition-transform duration-300 ${animationStage === 'levelUp' ? 'scale-150' : ''}`}>{displayLevel}</span>
                        </div>

                        <div className="relative pt-4">
                            {didLevelUp && (animationStage === 'levelUp' || animationStage === 'done') && (
                                <div className="absolute top-[-1rem] left-1/2 -translate-x-1/2 pointer-events-none">
                                    <span className="text-sm font-bold text-yellow-200 animate-level-up-pop-and-glow">LEVEL UP!</span>
                                </div>
                            )}
                            <div className="bg-slate-700 h-4 rounded-full overflow-hidden">
                                <div 
                                    className="bg-pink-500 h-full transition-all duration-1000 ease-out" 
                                    style={{
                                        width: animationStage === 'start' ? `${initialXpPercent}%` 
                                            : animationStage === 'filling' ? `${finalXpPercent}%`
                                            : animationStage === 'levelUp' ? '100%'
                                            : `${newLevelXpPercent}%`,
                                        transitionDuration: animationStage === 'done' && didLevelUp ? '0s' : '1s',
                                    }}
                                ></div>
                            </div>
                        </div>

                        <p className="text-right text-sm text-slate-400 mt-1">
                            {animationStage === 'done' && didLevelUp ? finalXp : initialXp + animatedXp}
                            /
                            {getXpForNextLevel(displayLevel)} XP
                        </p>
                    </div>

                    <h2 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Rewards</h2>
                     <div className="bg-slate-900/50 rounded-lg p-3 grid grid-cols-2 gap-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">💰</span>
                            <span className={`font-bold text-yellow-400 transition-opacity duration-500 ${animationStage !== 'start' ? 'opacity-100' : 'opacity-0'}`}>+{animatedCoins} Coins</span>
                        </div>
                         <div className="flex items-center gap-2">
                            <span className="text-xl">✨</span>
                            <span className={`font-bold text-purple-400 transition-opacity duration-500 ${animationStage !== 'start' ? 'opacity-100' : 'opacity-0'}`}>+{animatedXp} XP</span>
                        </div>
                        {gameMode === 'online' && (
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{cpChange >= 0 ? '🏆' : '💔'}</span>
                                <span className={`font-bold transition-opacity duration-500 ${animationStage !== 'start' ? 'opacity-100' : 'opacity-0'} ${cpChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {animatedCpChange >= 0 ? `+${animatedCpChange}` : animatedCpChange} CP
                                </span>
                            </div>
                        )}
                         {gameMode === 'online' && gameDuration && (
                            <div className="flex items-center gap-2">
                                <span className="text-xl">⏱️</span>
                                <span className={`font-bold text-slate-300 transition-opacity duration-500 ${animationStage !== 'start' ? 'opacity-100' : 'opacity-0'}`}>
                                    {gameDuration}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8 space-y-3">
                    {gameMode === 'pve' && (
                        <button onClick={onReset} className="w-full max-w-sm bg-green-500 hover:bg-green-400 text-black font-bold py-3 px-6 rounded-lg transition-colors text-lg">
                            Play again!
                        </button>
                    )}
                    <button onClick={onExit} className="w-full max-w-sm bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                       Back to {gameMode === 'online' ? 'Lobby' : 'Menu'}{leaveCountdown !== undefined && ` (${leaveCountdown}s)`}
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes level-up-pop {
                    0% { transform: scale(0.8); opacity: 0; }
                    50% { transform: scale(1.3); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes level-up-glow {
                    50% { text-shadow: 0 0 15px #fef08a, 0 0 8px #facc15; }
                }
                .animate-level-up-pop-and-glow {
                    animation: level-up-pop 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards, level-up-glow 1.5s ease-in-out infinite 0.5s;
                }
            `}</style>
        </div>
    );
};

export default GameOverScreen;