import React, { useEffect, useState, useMemo } from 'react';
import type { Player, GameMode, OnlineGame } from '../../types';
import { COIN_REWARD, XP_REWARD, getXpForNextLevel } from '../../constants';

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
  leaveCountdown: number;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({show, winner, timedOutPlayer, playerMark, onReset, onExit, playerLevel, playerXp, gameMode, leaveCountdown}) => {
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
    
    const title = useMemo(() => {
        if (winner === 'timeout') return didPlayerTimeout ? "TIME'S UP!" : "OPPONENT TIMED OUT";
        if (isWin) return "YOU WIN!";
        if (isDraw) return "IT'S A DRAW!";
        return "YOU LOSE!";
    }, [winner, didPlayerTimeout, isWin, isDraw]);

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
                <h1 className={`text-7xl font-black ${titleColor} mb-8`}>{title}</h1>
                
                <div className="bg-slate-800 rounded-xl p-6 w-80 mx-auto border border-slate-700 relative">
                     {animationStage === 'levelUp' && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-3xl font-bold text-yellow-300 animate-bounce">LEVEL UP!</div>
                    )}
                    <div className="text-left mb-4">
                        <div className="flex justify-between items-baseline mb-1">
                            <span className="font-semibold text-white">Level {displayLevel}</span>
                             <span className={`text-sm bg-pink-500 text-white font-bold px-2 py-0.5 rounded-full transition-transform duration-300 ${animationStage === 'levelUp' ? 'scale-150' : ''}`}>{displayLevel}</span>
                        </div>
                        <div className="bg-slate-700 h-4 rounded-full overflow-hidden relative">
                             <div 
                                className="bg-pink-500 h-full absolute transition-all duration-1000 ease-out" 
                                style={{
                                    width: animationStage === 'start' ? `${initialXpPercent}%` 
                                         : animationStage === 'filling' ? `${finalXpPercent}%`
                                         : animationStage === 'levelUp' ? '100%'
                                         : `${newLevelXpPercent}%`,
                                    transitionDuration: animationStage === 'done' && didLevelUp ? '0s' : '1s',
                                }}
                            ></div>
                        </div>
                        <p className="text-right text-sm text-slate-400 mt-1">
                            {animationStage === 'done' && didLevelUp ? finalXp : initialXp + animatedXp}
                            /
                            {getXpForNextLevel(displayLevel)} XP
                        </p>
                    </div>

                    <h2 className="font-bold text-slate-300 mb-2">REWARDS</h2>
                     <div className="bg-slate-900/50 rounded-lg p-3 flex justify-around">
                        <div className="flex flex-col items-center">
                            <span className="text-2xl">💰</span>
                            <span className={`font-bold text-yellow-400 text-xl transition-opacity duration-500 ${animationStage !== 'start' ? 'opacity-100' : 'opacity-0'}`}>+{animatedCoins}</span>
                        </div>
                         <div className="flex flex-col items-center">
                            <span className="text-2xl">✨</span>
                            <span className={`font-bold text-purple-400 text-xl transition-opacity duration-500 ${animationStage !== 'start' ? 'opacity-100' : 'opacity-0'}`}>+{animatedXp} XP</span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 space-y-3">
                    {gameMode === 'pve' && (
                        <button onClick={onReset} className="w-full max-w-sm bg-green-500 hover:bg-green-400 text-black font-bold py-3 px-6 rounded-lg transition-colors text-lg">
                            Play again!
                        </button>
                    )}
                    <button onClick={onExit} className="w-full max-w-sm bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                       Back to {gameMode === 'online' ? 'Lobby' : 'Menu'} ({leaveCountdown}s)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GameOverScreen;