import React, { useEffect } from 'react';
import type { OnlineGame } from '../../types';

interface VersusScreenProps {
    game: OnlineGame;
    currentUserId: string;
    onGameStart: () => void;
}

const PlayerCard: React.FC<{ player: { name: string, avatarUrl: string, level: number }, align: 'left' | 'right' }> = ({ player, align }) => {
    const animation = align === 'left' ? 'animate-slide-in-left' : 'animate-slide-in-right';
    return (
        <div className={`flex flex-col items-center ${animation}`}>
            <img src={player.avatarUrl} alt={player.name} className="w-32 h-32 rounded-full border-4 border-slate-600 bg-slate-800 object-cover mb-4" />
            <h3 className="text-2xl font-bold text-white">{player.name}</h3>
            <p className="text-cyan-400">Level {player.level}</p>
        </div>
    );
};


const VersusScreen: React.FC<VersusScreenProps> = ({ game, currentUserId, onGameStart }) => {

    useEffect(() => {
        const timer = setTimeout(() => {
            onGameStart();
        }, 1500); // Reduced from 4000ms to 1500ms

        return () => clearTimeout(timer);
    }, [onGameStart]);

    const opponentUid = game.players.X === currentUserId ? game.players.O : game.players.X;
    const playerDetails = game.playerDetails[currentUserId];
    const opponentDetails = game.playerDetails[opponentUid];

    if (!playerDetails || !opponentDetails) {
        return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center"><p>Loading player details...</p></div>;
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center justify-center relative overflow-hidden">
             <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%2D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%231e293b%22%20fill-opacity%3D%220.4%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2040L40%200H20L0%2020M40%2040V20L20%2040%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50"></div>
            <div className="w-full max-w-2xl flex items-center justify-around z-10">
                <PlayerCard player={playerDetails} align="left" />
                <div className="animate-zoom-in-out">
                    <h2 className="text-6xl font-black text-red-500" style={{ textShadow: '0 0 15px #ef4444' }}>VS</h2>
                </div>
                <PlayerCard player={opponentDetails} align="right" />
            </div>

            <p className="absolute bottom-10 text-slate-400 animate-pulse">Match Starting...</p>

            <style>{`
                @keyframes slide-in-left {
                    from { transform: translateX(-100vw); }
                    to { transform: translateX(0); }
                }
                .animate-slide-in-left { animation: slide-in-left 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
                
                @keyframes slide-in-right {
                    from { transform: translateX(100vw); }
                    to { transform: translateX(0); }
                }
                .animate-slide-in-right { animation: slide-in-right 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards; }

                @keyframes zoom-in-out {
                    0% { transform: scale(0.5); opacity: 0; }
                    50% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-zoom-in-out { animation: zoom-in-out 1.2s ease-out forwards; animation-delay: 0.2s; }
            `}</style>
        </div>
    );
};

export default VersusScreen;