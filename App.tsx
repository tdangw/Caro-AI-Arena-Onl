// FIX: Corrected import statement for React hooks.
import React, { useState, useCallback, useEffect, useRef } from 'react';
import MainMenu from './components/MainMenu';
import GameScreen from './components/GameScreen';
import Shop from './components/Shop';
import Inventory from './components/Inventory';
import AuthScreen from './components/AuthScreen';
import OnlineLobby from './components/OnlineLobby';
import { GameStateProvider, useGameState } from './context/GameStateContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { BotProfile, Invitation } from './types';
import { useSound } from './hooks/useSound';
import * as onlineService from './services/onlineService';
import Modal from './components/Modal';

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
    const { user, logOut } = useAuth();
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

    // --- Global Invitation State ---
    const [invitation, setInvitation] = useState<Invitation | null>(null);
    const [inviteCountdown, setInviteCountdown] = useState(10);

    // --- Idle Timeout Logic ---
    const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleLogout = useCallback(() => {
        if (user) { // Check if user exists before logging out
            console.log("User has been idle for 24 hours. Logging out.");
            logOut();
        }
    }, [user, logOut]);

    const resetIdleTimer = useCallback(() => {
        if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
        }
        idleTimerRef.current = setTimeout(handleLogout, IDLE_TIMEOUT_MS);
    }, [handleLogout]);

    useEffect(() => {
        if (!user) { // Don't run timer if not logged in
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            return;
        }

        const activityEvents: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        
        resetIdleTimer();

        activityEvents.forEach(event => {
            window.addEventListener(event, resetIdleTimer);
        });

        return () => {
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
            }
            activityEvents.forEach(event => {
                window.removeEventListener(event, resetIdleTimer);
            });
        };
    }, [resetIdleTimer, user]);


    // Run once on initial load to rejoin active games
    useEffect(() => {
        if (user) {
            onlineService.getOnlineUser(user.uid).then(player => {
                if (player?.status === 'in_game' && player.gameId) {
                    console.log(`Rejoining active game: ${player.gameId}`);
                    onStartOnlineGame(player.gameId);
                }
            });
        }
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
    
        // This listener is crucial for both starting a new game and for the rematch flow.
        const unsubscribe = onlineService.listenForGameStart(user.uid, (gameId) => {
            if (gameId && gameId !== activeOnlineGameId) {
                console.log(`Detected game change to ${gameId}. Switching...`);
                onStartOnlineGame(gameId);
            }
        });
        return () => unsubscribe();
    }, [user, activeOnlineGameId]);

    // Global listener for invitations
    useEffect(() => {
        if (!user) return;
        const unsubscribe = onlineService.listenForInvitations(user.uid, (inv) => {
          if(inv) playSound('select');
          setInvitation(inv);
        });
        return () => unsubscribe();
    }, [user, playSound]);

    const handleDeclineInvite = useCallback(() => {
        if (!user) return;
        playSound('select');
        onlineService.declineInvitation(user.uid);
        setInvitation(null);
    }, [user, playSound]);

    useEffect(() => {
        if (invitation) {
            setInviteCountdown(10);
            const timerId = setInterval(() => {
                setInviteCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(timerId);
                        handleDeclineInvite();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timerId);
        }
    }, [invitation, handleDeclineInvite]);
    
    const handleAcceptInvite = async () => {
        if (!user || !invitation) return;
        // This will create a new game, and the listenForGameStart hook will handle the transition.
        await onlineService.acceptInvitation(user, invitation);
        setInvitation(null);
    };

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
            // The cleanup effect in GameScreen will handle setting the user back to 'idle'.
            // This prevents a race condition that was causing the game over screen to loop.
            setView('lobby');
            setActiveOnlineGameId(null);
        } else {
            handleBackToMenu();
        }
    }, [view, handleBackToMenu]);
    
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

            <Modal isOpen={!!invitation} title="Incoming Challenge!">
                {invitation && (
                    <div className='text-center'>
                        <p className="text-slate-300 mb-6"><strong className='text-white'>{invitation.fromName}</strong> has challenged you to a match! <span className="text-slate-400">({inviteCountdown}s)</span></p>
                        <div className='flex justify-center gap-4'>
                            <button onClick={handleDeclineInvite} className="bg-red-600 hover:bg-red-500 font-bold py-2 px-6 rounded-lg transition-colors">Decline</button>
                            <button onClick={handleAcceptInvite} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg transition-colors">Accept</button>
                        </div>
                    </div>
                )}
            </Modal>

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