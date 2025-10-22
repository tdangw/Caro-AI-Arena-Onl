
import React, { useState, useCallback, useEffect } from 'react';
import MainMenu from './components/MainMenu';
import GameScreen from './components/GameScreen';
import Shop from './components/Shop';
import Inventory from './components/Inventory';
import AuthScreen from './components/AuthScreen';
import OnlineLobby from './components/OnlineLobby';
import { GameStateProvider, useGameState } from './context/GameStateContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { BotProfile } from './types';
import { useSound } from './hooks/useSound';
import * as onlineService from './services/onlineService';

type View = 'menu' | 'pve_game' | 'shop' | 'inventory' | 'lobby' | 'online_game';
type Overlay = 'shop' | 'inventory' | null;

const ACTIVE_PVE_GAME_BOT_KEY = 'caroActivePveGame_bot';

const LoadingScreen: React.FC = () => (
    <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center justify-center text-center">
        <h1 className="text-6xl md:text-8xl font-black text-white mb-2">
            Caro <span className="text-cyan-400">AI Arena</span>
        </h1>
        <p className="text-slate-400 text-xl mt-4">Loading...</p>
    </div>
);


const AppContent: React.FC = () => {
    const { user } = useAuth();
    const [view, setView] = useState<View>(() => {
        return localStorage.getItem(ACTIVE_PVE_GAME_BOT_KEY) ? 'pve_game' : 'menu';
    });
    const [activeBot, setActiveBot] = useState<BotProfile | null>(() => {
        try {
            const savedBot = localStorage.getItem(ACTIVE_PVE_GAME_BOT_KEY);
            return savedBot ? JSON.parse(savedBot) : null;
        } catch {
            localStorage.removeItem(ACTIVE_PVE_GAME_BOT_KEY);
            return null;
        }
    });
    const [activeOnlineGameId, setActiveOnlineGameId] = useState<string | null>(null);
    const [overlay, setOverlay] = useState<Overlay | null>(null);
    const { gameState } = useGameState();
    const { playSound, playMusic, stopMusic } = useSound();

    // Centralized cleanup for ghost players
    useEffect(() => {
        if (user) {
            const cleanupInterval = setInterval(() => onlineService.triggerCleanup(), 15000);
            onlineService.triggerCleanup(); // Run once on mount
            return () => clearInterval(cleanupInterval);
        }
    }, [user]);

    // Fast-path presence update for tab close
    useEffect(() => {
        if (!user) return;
        
        const handleBeforeUnload = () => {
            // This is a "best effort" attempt. The reliable part is the RTDB onDisconnect.
            onlineService.goOffline(user.uid);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [user]);


    useEffect(() => {
        if (view === 'menu' || view === 'pve_game' || view === 'lobby' || view === 'online_game') {
            playMusic();
        } else {
            stopMusic();
        }
    }, [view, playMusic, stopMusic]);

    // Centralized listener for game transitions (lobby -> game, and game -> rematch)
    useEffect(() => {
        if (!user) return;
    
        // This listener is active when in lobby or in a game
        if (view === 'lobby' || view === 'online_game') {
            const unsubscribe = onlineService.listenForGameStart(user.uid, (gameId) => {
                // If we get a new and different game ID, update our state to switch to it.
                if (gameId && gameId !== activeOnlineGameId) {
                    console.log(`Detected game change to ${gameId}. Switching...`);
                    onStartOnlineGame(gameId);
                }
            });
            return () => unsubscribe();
        }
    }, [view, user, activeOnlineGameId]);

    const handleStartPVEGame = useCallback((bot: BotProfile) => {
        try {
            playSound('select');
            localStorage.setItem(ACTIVE_PVE_GAME_BOT_KEY, JSON.stringify(bot));
            setActiveBot(bot);
            setView('pve_game');
        } catch (error) {
            console.error("Failed to save active bot:", error);
        }
    }, [playSound]);

    const handleGoToShop = useCallback(() => { playSound('select'); setView('shop'); }, [playSound]);
    const handleGoToInventory = useCallback(() => { playSound('select'); setView('inventory'); }, [playSound]);

    const handleBackToMenu = useCallback(() => {
        playSound('select');
        setView('menu');
        setActiveBot(null);
        setOverlay(null);
        setActiveOnlineGameId(null);
        localStorage.removeItem(ACTIVE_PVE_GAME_BOT_KEY);
        localStorage.removeItem('caroGameState_inProgress');
    }, [playSound]);

    const handleGoToOnline = () => {
        playSound('select');
        setView('lobby');
    };
    
    const onStartOnlineGame = (gameId: string) => {
        setActiveOnlineGameId(gameId);
        setView('online_game');
    };
    
    const handleOpenShopOverlay = () => { playSound('select'); setOverlay('shop'); };
    const handleOpenInventoryOverlay = () => { playSound('select'); setOverlay('inventory'); };
    const handleCloseOverlay = () => { playSound('select'); setOverlay(null); };

    const handleGameEnd = useCallback(() => {
        if (view === 'online_game') {
            if (user && activeOnlineGameId) {
                onlineService.leaveOnlineGame(activeOnlineGameId, user.uid);
            }
            setView('lobby'); // Go back to lobby after an online game
            setActiveOnlineGameId(null);
        } else {
            handleBackToMenu(); // Go back to main menu for PVE
        }
    }, [view, handleBackToMenu, user, activeOnlineGameId]);
    
    const renderView = () => {
        switch (view) {
            case 'lobby':
                return <OnlineLobby onStartGame={onStartOnlineGame} onBack={handleBackToMenu} />;
            case 'online_game':
                if (!activeOnlineGameId || !user) {
                    setView('lobby');
                    return null;
                }
                return <GameScreen 
                            key={activeOnlineGameId}
                            gameMode="online"
                            onlineGameId={activeOnlineGameId}
                            onExit={handleGameEnd} 
                            theme={gameState.activeTheme} 
                            pieces={{ X: gameState.activePieceX, O: gameState.activePieceO }}
                            playerInfo={{name: gameState.playerName, level: gameState.playerLevel, avatar: gameState.activeAvatar, xp: gameState.playerXp, wins: gameState.onlineWins, losses: gameState.onlineLosses}}
                            activeEffect={gameState.activeEffect}
                            activeVictoryEffect={gameState.activeVictoryEffect}
                            activeBoomEffect={gameState.activeBoomEffect}
                            isPaused={!!overlay}
                            onOpenShop={handleOpenShopOverlay}
                            onOpenInventory={handleOpenInventoryOverlay}
                        />;
            case 'pve_game':
                if (!activeBot) {
                    handleBackToMenu();
                    return null;
                }
                return <GameScreen 
                            key={activeBot.id}
                            gameMode="pve"
                            bot={activeBot} 
                            onExit={handleGameEnd} 
                            theme={gameState.activeTheme} 
                            pieces={{ X: gameState.activePieceX, O: gameState.activePieceO }}
                            playerInfo={{name: gameState.playerName, level: gameState.playerLevel, avatar: gameState.activeAvatar, xp: gameState.playerXp, wins: gameState.pveWins, losses: gameState.pveLosses}}
                            activeEffect={gameState.activeEffect}
                            activeVictoryEffect={gameState.activeVictoryEffect}
                            activeBoomEffect={gameState.activeBoomEffect}
                            isPaused={!!overlay}
                            onOpenShop={handleOpenShopOverlay}
                            onOpenInventory={handleOpenInventoryOverlay}
                        />;
            case 'shop':
                return <Shop onBack={handleBackToMenu} />;
            case 'inventory':
                return <Inventory onBack={handleBackToMenu} />;
            case 'menu':
            default:
                return <MainMenu 
                            onStartGame={handleStartPVEGame}
                            onGoToShop={handleGoToShop} 
                            onGoToInventory={handleGoToInventory}
                            onGoToOnline={handleGoToOnline}
                        />;
        }
    };

    return (
        <div className="bg-slate-900 relative animate-app-fade-in">
            {renderView()}
            {overlay && (
                <div className="fixed inset-0 z-50 bg-black/70 p-4 sm:p-8 overflow-y-auto">
                    {overlay === 'shop' && <Shop onBack={handleCloseOverlay} />}
                    {overlay === 'inventory' && <Inventory onBack={handleCloseOverlay} />}
                </div>
            )}
            <style>{`
                @keyframes app-fade-in {
                    from { opacity: 0; transform: scale(0.97); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-app-fade-in { animation: app-fade-in 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
            `}</style>
        </div>
    );
}

const AppController: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <LoadingScreen />;
    }

    if (user) {
        return <AppContent />;
    }

    return <AuthScreen />;
}


export default function App() {
    return (
        <AuthProvider>
            <GameStateProvider>
                <AppController />
            </GameStateProvider>
        </AuthProvider>
    );
}
