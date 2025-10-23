import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as onlineService from '../services/onlineService';
import type { OnlinePlayer, Invitation, OnlineGame } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSound } from '../hooks/useSound';
import Modal from './Modal';
import { SettingsModal } from './game/GameModals';
import VersusScreen from './game/VersusScreen';
import { useGameState } from '../context/GameStateContext';
import { getRankFromCp } from '../constants';

interface OnlineLobbyProps {
  onStartGame: (gameId: string) => void;
  onBack: () => void;
}

interface SearchingModalProps {
  onCancel: () => void;
}

const SearchingModal: React.FC<SearchingModalProps> = ({ onCancel }) => {
  const [timeLeft, setTimeLeft] = useState(30);
  const animationStartRef = useRef<number | null>(null);

  useEffect(() => {
    let animationFrameId: number;

    const animate = (timestamp: number) => {
        if (animationStartRef.current === null) {
            animationStartRef.current = timestamp;
        }
        const elapsed = timestamp - animationStartRef.current;
        const newTimeLeft = Math.max(0, 30 - elapsed / 1000);
        
        setTimeLeft(newTimeLeft);

        if (newTimeLeft > 0) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            onCancel();
        }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [onCancel]);

  const displayCountdown = Math.ceil(timeLeft);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (timeLeft / 30) * circumference;

  return (
    <div className="fixed inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-48 h-48 flex items-center justify-center">
        <svg className="w-full h-full" viewBox="0 0 140 140">
           <defs>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
          </defs>
          <circle cx="70" cy="70" r="68" stroke="url(#goldGradient)" strokeWidth="2" fill="transparent" />
          <circle cx="70" cy="70" r="60" stroke="rgba(0,0,0,0.5)" strokeWidth="8" fill="transparent" />
          <circle
            cx="70"
            cy="70"
            r={60}
            stroke="url(#blueGradient)"
            strokeWidth="8"
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transform -rotate-90 origin-center"
            style={{ filter: 'url(#glow)'}}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-white">
            <span className="text-5xl font-bold tracking-tighter" style={{ textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>{displayCountdown}</span>
        </div>
      </div>
       <h2 className="text-3xl font-bold text-white mt-8" style={{ textShadow: '0 0 15px rgba(56, 189, 248, 0.5)'}}>
        Finding Opponent
      </h2>
      <button
        onClick={onCancel}
        className="mt-8 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
      >
        Cancel
      </button>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
};

const OnlineLobby: React.FC<OnlineLobbyProps> = ({ onStartGame, onBack }) => {
  const { user, logOut } = useAuth();
  const { gameState } = useGameState();
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [versusGame, setVersusGame] = useState<OnlineGame | null>(null);
  const [invitedPlayerIds, setInvitedPlayerIds] = useState<Record<string, 'invited'>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { playSound } = useSound();

  const handleGameFound = async (gameId: string) => {
    setIsSearching(false);
    const game = await onlineService.getOnlineGame(gameId);
    if(game) {
        setVersusGame(game);
        playSound('confirm');
    } else {
        if(user) onlineService.returnToLobby(user.uid);
    }
  }

  useEffect(() => {
    if (!user) return;
    
    onlineService.getOnlineUser(user.uid).then(p => {
        if (p?.status === 'in_queue') setIsSearching(true);
    })

    const unsubscribePlayers = onlineService.getOnlinePlayers((onlinePlayers) => {
      setPlayers(onlinePlayers.filter(p => p.uid !== user.uid));
    });

    const unsubscribeGame = onlineService.listenForGameStart(user.uid, (playerData) => {
        // Only react to a new game if the user is in a state where they expect one.
        // This prevents re-triggering the Versus screen when exiting a finished game.
        if (playerData && playerData.gameId && (playerData.status === 'idle' || playerData.status === 'in_queue')) {
            handleGameFound(playerData.gameId);
        }
    });

    return () => {
      unsubscribePlayers();
      unsubscribeGame();
    };
  }, [user]);
  
  const handleInvite = (player: OnlinePlayer) => {
    if (!user) return;
    playSound('select');
    onlineService.sendInvitation(user, player.uid);
    setInvitedPlayerIds(prev => ({...prev, [player.uid]: 'invited' }));

    setTimeout(() => {
      setInvitedPlayerIds(prev => {
        const newState = {...prev};
        delete newState[player.uid];
        return newState;
      });
    }, 11000); // 10s invite timeout + 1s buffer
  };
  
  const handleFindMatch = async () => {
    if (!user) return;
    setIsSearching(true);
    playSound('select');
    const gameId = await onlineService.joinMatchmakingQueue(user);
    if (gameId) {
        handleGameFound(gameId);
    }
  };

  const handleCancelSearch = () => {
      if (!user) return;
      playSound('select');
      onlineService.cancelMatchmaking(user.uid);
      setIsSearching(false);
  }
  
  const { onlineWins, onlineLosses, onlineDraws, cp, coins } = gameState;
  const totalGames = onlineWins + onlineLosses + onlineDraws;
  const winRate = totalGames > 0 ? ((onlineWins / totalGames) * 100).toFixed(2) : '0.00';
  const rank = getRankFromCp(cp);


  if (versusGame && user) {
    return <VersusScreen game={versusGame} currentUserId={user.uid} onGameStart={() => onStartGame(versusGame.id)} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 flex flex-col items-center justify-center relative">
      {isSearching && <SearchingModal onCancel={handleCancelSearch} />}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%2D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%231e293b%22%20fill-opacity%3D%220.4%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2040L40%200H20L0%2020M40%2040V20L20%2040%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50"></div>

      <div className="w-full max-w-4xl text-center z-10">
        <header className="flex justify-between items-center mb-6">
            <h1 className="text-4xl font-bold text-cyan-400">Online Lobby</h1>
             <div className="flex items-center gap-2">
                <button onClick={onBack} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                    Menu
                </button>
                <button onClick={() => { playSound('select'); setIsSettingsOpen(true); }} className="bg-slate-700/80 p-2 rounded-full hover:bg-slate-600 transition-colors" aria-label="Settings">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826 3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
            </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-4 h-[60vh] flex flex-col">
                <h2 className="text-xl font-semibold text-white mb-4 text-left">Players Online ({players.length})</h2>
                <div className="flex-grow overflow-y-auto pr-2 scrollbar-hide">
                    {players.length > 0 ? (
                        players.map(p => {
                            const inviteStatus = invitedPlayerIds[p.uid];
                            return (
                                <div key={p.uid} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg mb-2">
                                    <div className="flex items-center gap-3">
                                        <img src={p.avatarUrl} alt={p.name} className="w-10 h-10 rounded-full object-cover bg-slate-700" />
                                        <div>
                                            <p className="font-semibold text-white text-left">{p.name}</p>
                                            <p className="text-slate-400 text-sm text-left">Level {p.level}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-semibold ${p.status === 'idle' ? 'text-green-400' : 'text-yellow-400'}`}>
                                            {p.status.replace('_', ' ')}
                                        </p>
                                        <button 
                                            onClick={() => handleInvite(p)} 
                                            disabled={p.status !== 'idle' || !!inviteStatus}
                                            className={`text-xs text-white font-bold px-3 py-1 rounded-full mt-1 transition-colors ${inviteStatus ? 'bg-slate-600 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-400'}`}
                                        >
                                            {inviteStatus ? 'Invited' : 'Invite'}
                                        </button>
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        <p className="text-slate-500 text-center pt-16">No other players online right now.</p>
                    )}
                </div>
            </div>
            <div className="md:col-span-1 flex flex-col gap-6">
                 <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                        <img src={gameState.activeAvatar.url} alt="Your Avatar" className="w-14 h-14 rounded-full flex-shrink-0 border-2 border-slate-600 object-cover bg-slate-700" />
                        <div className="text-left">
                            <h2 className="text-lg font-bold text-white truncate">{gameState.playerName}</h2>
                            <div className="flex items-center gap-4">
                                <span className="font-semibold text-cyan-400 text-sm">Level {gameState.playerLevel}</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-yellow-400 font-bold text-sm">{coins}</span>
                                    <span className="text-yellow-400">💰</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-2 text-left bg-slate-900/50 rounded-lg p-2 flex items-center justify-between">
                        <p className="text-sm font-semibold">{rank.icon} {rank.name}</p>
                        <p className="text-xs text-slate-300">{rank.cpInTier} / 100 CP</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mt-3">
                        <div className="p-1">
                            <p className="text-green-400 font-bold text-lg">{onlineWins}</p>
                            <p className="text-slate-400 text-[10px] leading-tight uppercase tracking-wider">Wins</p>
                        </div>
                        <div className="p-1">
                            <p className="text-red-400 font-bold text-lg">{onlineLosses}</p>
                            <p className="text-slate-400 text-[10px] leading-tight uppercase tracking-wider">Losses</p>
                        </div>
                        <div className="p-1">
                            <p className="text-cyan-400 font-bold text-lg">{winRate}%</p>
                            <p className="text-slate-400 text-[10px] leading-tight uppercase tracking-wider">Win Rate</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 flex flex-col justify-center items-center flex-grow">
                     <h2 className="text-2xl font-bold text-white mb-4">Matchmaking</h2>
                     <p className="text-slate-400 mb-6">Find a random opponent and jump right into a game.</p>
                     <button 
                        onClick={handleFindMatch} 
                        className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3 px-4 rounded-lg transition-all text-lg mt-auto"
                    >
                        Find Match
                     </button>
                </div>
            </div>
        </div>
      </div>
      
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onLogOut={logOut}
      />
    </div>
  );
};

export default OnlineLobby;