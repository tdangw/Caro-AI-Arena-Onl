import React, { useEffect, useState } from 'react';
import type { RankInfo } from '../types';
import Modal from './Modal';
import { useSound } from '../hooks/useSound';

interface RankChangeModalProps {
    notification: { type: 'up' | 'down', from: RankInfo, to: RankInfo } | null;
    onClose: () => void;
}

const RankChangeModal: React.FC<RankChangeModalProps> = ({ notification, onClose }) => {
    const [animationState, setAnimationState] = useState<'idle' | 'in' | 'out'>('idle');
    const { playSound } = useSound();

    useEffect(() => {
        if (notification) {
            playSound(notification.type === 'up' ? 'win' : 'lose');
            setAnimationState('in');
            const timer = setTimeout(() => {
                setAnimationState('out');
                setTimeout(onClose, 500);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [notification, onClose, playSound]);

    if (!notification) {
        return null;
    }

    const { type, from, to } = notification;
    const isPromotion = type === 'up';
    const title = isPromotion ? 'PROMOTION!' : 'DEMOTION';
    const titleColor = isPromotion ? 'text-green-400' : 'text-red-500';

    return (
        <div className={`fixed inset-0 bg-black/80 flex items-center justify-center z-[100] transition-opacity duration-300 ${animationState === 'in' ? 'opacity-100' : 'opacity-0'}`}>
            <div className={`relative w-full max-w-sm bg-slate-900 border-2 rounded-2xl p-8 text-center overflow-hidden animate-scale-in ${isPromotion ? 'border-green-500' : 'border-red-500'}`}
                style={isPromotion ? {boxShadow: '0 0 30px rgba(74, 222, 128, 0.5)'} : {boxShadow: '0 0 30px rgba(239, 68, 68, 0.5)'}}>
                
                <h2 className={`text-5xl font-black mb-6 animate-fade-in-down ${titleColor}`}>{title}</h2>

                <div className="relative h-28 flex items-center justify-center">
                    {/* Old Rank (disappearing) */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center animate-rank-out">
                        <div className="text-6xl">{from.icon}</div>
                        <p className="text-xl font-bold text-slate-400">{from.name}</p>
                    </div>

                    {/* New Rank (appearing) */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 animate-rank-in">
                        <div className="text-7xl">{to.icon}</div>
                        <p className={`text-2xl font-bold ${titleColor}`}>{to.name}</p>
                    </div>
                </div>

                <div className="absolute -bottom-24 -left-24 w-60 h-60 rounded-full bg-gradient-radial from-slate-700/50 to-transparent blur-xl"></div>
                <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full bg-gradient-radial from-slate-700/50 to-transparent blur-xl"></div>
            </div>
            <style>{`
                @keyframes scale-in { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                .animate-scale-in { animation: scale-in 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
                
                @keyframes fade-in-down { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .animate-fade-in-down { animation: fade-in-down 0.5s ease-out 0.2s forwards; }

                @keyframes rank-out {
                    0% { transform: scale(1) translateY(0); opacity: 1; }
                    100% { transform: scale(0.7) translateY(-30px); opacity: 0; }
                }
                .animate-rank-out { animation: rank-out 0.8s ease-in-out 0.5s forwards; }

                @keyframes rank-in {
                    0% { transform: scale(0.7) translateY(30px); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-rank-in { animation: rank-in 0.8s ease-in-out 1.5s forwards; }
            `}</style>
        </div>
    );
};

export default RankChangeModal;
