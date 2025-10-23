import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useGameLogic } from '../../hooks/useGameLogic';
import { getAIMove } from '../../services/aiService';
import { updateOpeningBook } from '../../services/openingBook';
import * as onlineService from '../../services/onlineService';
import type { Player, GameTheme, PieceStyle, BotProfile, Avatar, Emoji, PieceEffect, VictoryEffect, BoomEffect, GameMode, OnlineGame } from '../../types';
// FIX: Added TURN_TIME to imports for use in the timer bar and turn calculations.
import { PIECE_STYLES, EffectStyles, VictoryAndBoomStyles, TURN_TIME } from '../../constants';
import { useGameState } from '../../context/GameStateContext';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../hooks/useSound';

// Import newly created sub-components
import GameBoard from './GameBoard';
import PlayerInfo from './PlayerInfo';
import GameOverScreen from './GameOverScreen';
import FirstMoveAnimation from './FirstMoveAnimation';
import SmoothTimerBar from './SmoothTimerBar';
import Emote from './Emote';
import { SettingsModal, UndoModal } from './GameModals';

type GameOverStage = 'none' | 'banner' | 'effects' | 'summary';

const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// --- GameScreen Main Component ---
interface GameScreenProps {
  gameMode: GameMode;
  bot?: BotProfile;
  onlineGameId?: string;
  onExit: () => void;
  onRematch?: (newGameId: string) => void;
  theme: GameTheme;
  pieces: { X: PieceStyle, O: PieceStyle };
  playerInfo: { name: string, level: number, avatar: Avatar, xp: number, wins: number, losses: number };
  activeEffect: PieceEffect;
  activeVictoryEffect: VictoryEffect;
  activeBoomEffect: BoomEffect;
  isPaused: boolean;
  onOpenShop: () => void;
  onOpenInventory: () => void;
}

const GameScreen: React.FC<GameScreenProps> = ({ gameMode, bot, onlineGameId, onExit, onRematch, theme, pieces, playerInfo, activeEffect, activeVictoryEffect, activeBoomEffect, isPaused, onOpenShop, onOpenInventory }) => {
    const { user } = useAuth();
    const pveGame = useGameLogic('X', isPaused);
    const [onlineGame, setOnlineGame] = useState<OnlineGame | null>(null);
    const [isLoadingOnlineGame, setIsLoadingOnlineGame] = useState(true);
    const [onlineBoard, setOnlineBoard] = useState(() => onlineService.mapToBoard({}));
    const [aiPieceStyle, setAiPieceStyle] = useState<PieceStyle>(pieces.O);

    const { gameState, consumeEmoji, spendCoins, applyGameResult } = useGameState();
    const { playSound } = useSound();

    const [aiThinkingCell, setAiThinkingCell] = useState<{row: number, col: number} | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isEmojiPanelOpen, setEmojiPanelOpen] = useState(false);
    const [lastMove, setLastMove] = useState<{row: number, col: number} | null>(null);
    const [gameOverStage, setGameOverStage] = useState<GameOverStage>('none');
    const [winnerPlayer, setWinnerPlayer] = useState<Player | null>(null);
    const [boomCoords, setBoomCoords] = useState<{ winner?: DOMRect; loser?: DOMRect } | null>(null);
    const [gameOverMessage, setGameOverMessage] = useState<string | null>(null);
    const [isUndoModalOpen, setIsUndoModalOpen] = useState(false);
    
    // FIX: Added state and ref for the turn timer in online mode and the game over countdown.
    const [onlineTurnTimeLeft, setOnlineTurnTimeLeft] = useState(TURN_TIME);
    const [leaveCountdown, setLeaveCountdown] = useState(15);
    const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [playerEmote, setPlayerEmote] = useState<{key: number, emoji: string} | null>(null);
    const [opponentEmote, setOpponentEmote] = useState<{key: number, emoji: string} | null>(null);
    const isGameResultProcessedRef = useRef(false);
    const [showOnlineFirstMove, setShowOnlineFirstMove] = useState(false);
    
    const isAiThinkingRef = useRef(false);
    const playerAvatarRef = useRef<HTMLDivElement>(null);
    const opponentAvatarRef = useRef<HTMLDivElement>(null);

    // --- Derived State ---
    const playerMark = useMemo(() => {
        if (gameMode === 'online' && onlineGame && user) {
            return onlineGame.players.X === user.uid ? 'X' : 'O';
        }
        return 'X';
    }, [gameMode, onlineGame, user]);

    const opponentMark = playerMark === 'X' ? 'O' : 'X';
    
    // FIX: Replaced `{ ...pveGame }` with `pveGame` directly. The spread was unnecessary and likely causing the destructuring error.
    const { board, currentPlayer, winner, isGameOver, winningLine, isDecidingFirst, totalGameTime, moveHistory, gameId } = gameMode === 'online' && onlineGame ? {
        board: onlineBoard,
        currentPlayer: onlineGame.currentPlayer,
        winner: onlineGame.winner,
        isGameOver: onlineGame.status === 'finished',
        winningLine: onlineGame.winningLine || [],
        isDecidingFirst: false,
        totalGameTime: 900,
        moveHistory: [],
        gameId: onlineGame.id,
    } : pveGame;

    useEffect(() => {
        isGameResultProcessedRef.current = false;
        setGameOverStage('none');
    }, [gameId]);

    const opponentInfo = useMemo(() => {
        if (gameMode === 'online' && onlineGame && user) {
            const opponentUid = onlineGame.players.X === user.uid ? onlineGame.players.O : onlineGame.players.X;
            const details = onlineGame.playerDetails[opponentUid];
            return {
                name: details?.name || 'Opponent',
                avatar: details?.avatarUrl || 'assets/avatars/avatar_1.png',
                level: details?.level || 1,
            };
        }
        if (gameMode === 'pve' && bot) {
            return {
                name: bot.name,
                avatar: bot.avatar,
                level: bot.level,
                skillLevel: bot.skillLevel
            };
        }
        return { name: 'Player', avatar: '', level: 1 };
    }, [gameMode, onlineGame, user, bot]);

    const botStats = gameState.botStats[bot?.id || ''] || { wins: 0, losses: 0, draws: 0 };

    const ownedEmojis = useMemo(() => {
        return onlineService.getOwnedEmojis(gameState.ownedCosmeticIds, gameState.emojiInventory);
    }, [gameState.ownedCosmeticIds, gameState.emojiInventory]);

    // FIX: Added an effect to handle the online turn timer.
    useEffect(() => {
        if (gameMode !== 'online' || !onlineGame || onlineGame.status === 'finished' || isPaused) {
            return;
        }

        const timerId = setInterval(() => {
            const elapsed = (Date.now() - onlineGame.turnStartedAt) / 1000;
            const remaining = TURN_TIME - elapsed;
            setOnlineTurnTimeLeft(Math.max(0, remaining));

            if (remaining < -2 && onlineGame.currentPlayer !== playerMark && user) {
                onlineService.claimTimeoutVictory(onlineGame.id, playerMark);
            }
        }, 500);

        return () => clearInterval(timerId);
    }, [gameMode, onlineGame, isPaused, playerMark, user]);

    // FIX: Added an effect to handle the game over screen countdown.
    useEffect(() => {
        const clearCountdown = () => {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
            }
        };

        if (gameOverStage === 'summary') {
            setLeaveCountdown(15);
            countdownIntervalRef.current = setInterval(() => {
                setLeaveCountdown(prev => {
                    if (prev <= 1) {
                        clearCountdown();
                        onExit();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            clearCountdown();
        }
        
        return clearCountdown;
    }, [gameOverStage, onExit]);


    // --- PVE Logic ---
    useEffect(() => {
        if (gameMode === 'pve' && pveGame.isDecidingFirst) {
            const randomPiece = PIECE_STYLES[Math.floor(Math.random() * PIECE_STYLES.length)];
            setAiPieceStyle(randomPiece);
        }
    }, [gameMode, pveGame.isDecidingFirst]);

    useEffect(() => {
        if (gameMode !== 'pve' || isPaused || isDecidingFirst || isGameOver || currentPlayer !== opponentMark || !bot) {
            isAiThinkingRef.current = false;
            return;
        }
        if (isAiThinkingRef.current) return;

        isAiThinkingRef.current = true;

        if (Math.random() < 0.15) {
            setTimeout(() => setOpponentEmote({ key: Date.now(), emoji: onlineService.getRandomEmoji().emoji }), 500);
        }

        const onThinking = (move: { row: number; col: number }) => setAiThinkingCell(move);
        getAIMove(board, opponentMark, bot.skillLevel, onThinking).then(({ row, col }) => {
            if (row !== -1 && isAiThinkingRef.current && !isGameOver) {
                setAiThinkingCell(null);
                playSound('move');
                pveGame.makeMove(row, col);
                setLastMove({row, col});
            } else {
                isAiThinkingRef.current = false;
                setAiThinkingCell(null);
            }
        }).catch((err) => {
            console.error("AI failed to make a move:", err);
            setAiThinkingCell(null);
            isAiThinkingRef.current = false;
        });
    }, [currentPlayer, isGameOver, board, isPaused, isDecidingFirst, opponentMark, bot, gameMode, playSound, pveGame]);

    // --- Online Logic ---
    useEffect(() => {
        if (gameMode !== 'online' || !onlineGameId) {
            setIsLoadingOnlineGame(false);
            return;
        }
        setIsLoadingOnlineGame(true);
        let gameLoadedOnce = false;
        const unsubscribe = onlineService.getOnlineGameStream(onlineGameId, (game) => {
            if (game) {
                if (!gameLoadedOnce) {
                    gameLoadedOnce = true;
                    if (Object.keys(game.board).length === 0) {
                        setShowOnlineFirstMove(true);
                    }
                }
                setOnlineGame(game);
                
                setOnlineBoard(prevBoard => {
                    const newBoard = onlineService.mapToBoard(game.board);
                    if (JSON.stringify(prevBoard) !== JSON.stringify(newBoard)) {
                        playSound('move');
                        setLastMove(onlineService.getLastMove(prevBoard, newBoard));
                        return newBoard;
                    }
                    return prevBoard;
                });
            } else {
                if (gameLoadedOnce) {
                    onExit();
                }
            }
            setIsLoadingOnlineGame(false);
        });

        return () => unsubscribe();
    }, [gameMode, onlineGameId, onExit, playSound]);


    // --- Shared Logic ---
    const handleCellClick = (row: number, col: number) => {
        if (isGameOver || currentPlayer !== playerMark || board[row][col] !== null) return;
        
        if (gameMode === 'pve' && !isDecidingFirst) {
            playSound('move');
pveGame.makeMove(row, col);
            setLastMove({row, col});
        } else if (gameMode === 'online' && onlineGameId) {
            onlineService.makeOnlineMove(onlineGameId, row, col, playerMark);
        }
    };
    
    const resign = () => {
        if (isGameOver) return;
        if (gameMode === 'pve') pveGame.resign();
        else if (gameMode === 'online' && onlineGameId) onlineService.resignOnlineGame(onlineGameId, playerMark);
    };

    const handleGameReset = useCallback(() => {
        playSound('select');
        setGameOverStage('none');
        setGameOverMessage(null);
        setWinnerPlayer(null);
        isGameResultProcessedRef.current = false;
        if (gameMode === 'pve') {
            const randomPiece = PIECE_STYLES[Math.floor(Math.random() * PIECE_STYLES.length)];
            setAiPieceStyle(randomPiece);
            pveGame.resetGameForRematch();
        }
    }, [pveGame, gameMode, playSound]);
    
    useEffect(() => {
        if (isGameOver && winner && !isGameResultProcessedRef.current) {
            isGameResultProcessedRef.current = true;
            const result = winner === playerMark ? 'win' : winner === 'draw' ? 'draw' : 'loss';
            const opponentId = gameMode === 'pve' ? bot!.id : (onlineGame?.players.X === user?.uid ? onlineGame?.players.O : onlineGame?.players.X) || 'unknown';
            applyGameResult(result, opponentId, gameId);
            
            if (result === 'win') { playSound('win'); playSound('announce_win'); setGameOverMessage('You Win!'); } 
            else if (result === 'loss') { playSound('lose'); playSound('announce_lose'); setGameOverMessage('You Lose!'); }
            else { setGameOverMessage('Draw!'); }

            if (gameMode === 'pve' && winner === opponentMark) updateOpeningBook(moveHistory);

            setGameOverStage('banner');
            
            const effectsTimer = setTimeout(() => {
                setGameOverMessage(null);
                if (winner !== 'draw' && winner !== 'timeout') {
                    setWinnerPlayer(winner as Player);
                    const winnerRef = (winner as Player) === playerMark ? playerAvatarRef : opponentAvatarRef;
                    const loserRef = (winner as Player) === playerMark ? opponentAvatarRef : playerAvatarRef;
                    setBoomCoords({
                        winner: winnerRef.current?.getBoundingClientRect(),
                        loser: loserRef.current?.getBoundingClientRect()
                    });
                    setTimeout(() => playSound('boom'), 800);
                    setGameOverStage('effects');
                }
            }, 2000);

            const summaryTimer = setTimeout(() => {
                setGameOverStage('summary');
                playSound('summary');
            }, 5000);

            return () => { clearTimeout(effectsTimer); clearTimeout(summaryTimer); };
        }
    }, [isGameOver, winner, playerMark, opponentMark, moveHistory, playSound, applyGameResult, bot, gameId, gameMode, onlineGame, user]);

    // --- Other Handlers ---
    const handleUndoClick = () => { if (pveGame.canUndo && gameState.coins >= 20) setIsUndoModalOpen(true); };
    const handleConfirmUndo = () => { if (spendCoins(20)) pveGame.undoMove(); setIsUndoModalOpen(false); };
    
    const handleSendEmoji = (emoji: Emoji) => {
        playSound('select');
        setPlayerEmote({ key: Date.now(), emoji: emoji.emoji });
        consumeEmoji(emoji.id);
        setEmojiPanelOpen(false);
    };
    
    const allPieces = useMemo(() => {
        if (gameMode === 'pve') {
            return { X: pieces.X, O: aiPieceStyle };
        }
        return pieces;
    }, [gameMode, pieces, aiPieceStyle]);

    const DecoratorComponent = theme.decoratorComponent;
    const VictoryComponent = activeVictoryEffect.component;
    const BoomComponent = activeBoomEffect.component;
    
    // FIX: Define the turnTimeLeft variable to be used by the SmoothTimerBar.
    const turnTimeLeft = gameMode === 'pve' ? pveGame.turnTimeLeft : onlineTurnTimeLeft;


    if (gameMode === 'online' && isLoadingOnlineGame) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xl">Entering match...</p>
                </div>
            </div>
        );
    }
    
    return (
    <div
        style={theme.boardBgImage ? { backgroundImage: `url(${theme.boardBgImage})` } : {}}
        className={`${theme.boardBg} min-h-screen p-2 sm:p-4 flex flex-col items-center justify-center font-sans transition-colors duration-500 relative overflow-hidden bg-cover bg-center bg-no-repeat`}
    >
        {DecoratorComponent && <DecoratorComponent />}
        <EffectStyles />
        <VictoryAndBoomStyles />

        {playerEmote && <Emote key={playerEmote.key} emoji={playerEmote.emoji} startRef={playerAvatarRef} onEnd={() => setPlayerEmote(null)} />}
        {opponentEmote && <Emote key={opponentEmote.key} emoji={opponentEmote.emoji} startRef={opponentAvatarRef} onEnd={() => setOpponentEmote(null)} />}

        <div className="w-full max-w-[85vmin] mx-auto relative z-10 flex flex-col justify-center">
            <header className="flex flex-col justify-center items-center w-full relative mb-4">
                 <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 to-blue-400 text-shadow">
                    Caro AI Arena
                </h1>
                <div className="relative flex items-center justify-center gap-4 mt-2">
                    <button onClick={() => { playSound('select'); setIsSettingsOpen(true); }} className="bg-slate-800/80 p-2 rounded-full hover:bg-slate-700 transition-colors" aria-label="Settings"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826 3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
                    {gameMode === 'pve' && <button onClick={handleUndoClick} disabled={!pveGame.canUndo || gameState.coins < 20} className="relative bg-slate-800/80 p-2 rounded-full hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Undo"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8a5 5 0 000-10H9"></path></svg></button>}
                    <button onClick={() => { playSound('select'); setEmojiPanelOpen(p => !p); }} className="bg-slate-800/80 p-2 rounded-full hover:bg-slate-700 transition-colors" aria-label="Emotes"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                    {isEmojiPanelOpen && ( <div className="absolute top-full mt-4 bg-slate-800/90 backdrop-blur-sm p-2 rounded-lg flex flex-wrap justify-center gap-2 animate-fade-in-down z-30" style={{width: '280px'}} onMouseLeave={() => setEmojiPanelOpen(false)}> {ownedEmojis.map(e => <button key={e.id} onClick={() => handleSendEmoji(e)} className="text-3xl w-12 h-12 flex items-center justify-center rounded-md hover:bg-slate-700/50 hover:scale-110 transition-all">{e.emoji}</button>)} </div> )}
                </div>
            </header>

            <main className="flex-grow flex flex-col justify-center relative">
                 {gameOverStage === 'banner' && gameOverMessage && (<div className="absolute top-28 left-1/2 -translate-x-1/2 w-max px-8 py-4 bg-slate-900/80 border border-slate-700 rounded-2xl shadow-lg z-30 pointer-events-none animate-fade-in-down-then-out"><h2 className={`text-5xl font-black ${ gameOverMessage.includes('Win') ? 'text-green-400' : gameOverMessage.includes('Lose') ? 'text-red-500' : 'text-yellow-400' }`} style={{ textShadow: '0 0 15px currentColor' }}>{gameOverMessage}</h2></div>)}
                 
                 <div className="flex justify-between items-end px-2 mb-[4px] -mt-px">
                    <PlayerInfo ref={playerAvatarRef} name={playerInfo.name} avatar={playerInfo.avatar.url} level={playerInfo.level} align="left" player={playerMark} isCurrent={currentPlayer === playerMark} piece={allPieces.X} />
                    <div className="text-center pb-1 text-shadow">
                        {gameMode === 'pve' && bot && <div className="text-white font-mono text-xs tracking-wider whitespace-nowrap" title={`vs ${bot.name}`}><span className="text-green-400">Win {botStats.wins}</span> - <span className="text-red-400">Lose {botStats.losses}</span></div>}
                        <div className="text-white font-mono text-xl tracking-wider">{formatTime(totalGameTime)}</div>
                    </div>
                    <PlayerInfo ref={opponentAvatarRef} name={opponentInfo.name} avatar={opponentInfo.avatar} level={opponentInfo.level} align="right" player={opponentMark} isCurrent={currentPlayer === opponentMark} piece={allPieces.O} skillLevel={gameMode === 'pve' ? bot?.skillLevel : undefined} />
                </div>
                <div className="w-full mx-auto">
                    {/* FIX: Replaced incorrect 'currentPlayer' prop with 'duration' and 'time' props. */}
                    <SmoothTimerBar duration={TURN_TIME} time={turnTimeLeft} isPaused={isPaused} isGameOver={isGameOver} isDecidingFirst={isDecidingFirst} />
                    <div className="mt-px relative bg-black/40 backdrop-blur-lg rounded-xl p-2 border border-white/10 shadow-lg">
                        <GameBoard board={board} onCellClick={handleCellClick} winningLine={winningLine} pieces={allPieces} aiThinkingCell={aiThinkingCell} theme={theme} lastMove={lastMove} effect={activeEffect} />
                        {isDecidingFirst && gameMode === 'pve' && <FirstMoveAnimation pieces={allPieces} onAnimationEnd={pveGame.beginGame} playerMark={playerMark} playSound={playSound} gameMode="pve" playerInfo={playerInfo} opponentInfo={opponentInfo} />}
                        {showOnlineFirstMove && gameMode === 'online' && onlineGame && <FirstMoveAnimation pieces={allPieces} onAnimationEnd={() => setShowOnlineFirstMove(false)} playerMark={playerMark} playSound={playSound} gameMode="online" forcedWinner={onlineGame.currentPlayer} playerInfo={playerInfo} opponentInfo={opponentInfo} />}
                    </div>
                </div>
            </main>
        </div>
        
        {gameOverStage === 'effects' && winnerPlayer && boomCoords && ( <><VictoryComponent /> <BoomComponent winnerCoords={boomCoords?.winner} loserCoords={boomCoords?.loser} /></>)}

        {/* FIX: Removed unsupported 'onRematch' prop and added required 'leaveCountdown' prop. */}
        <GameOverScreen 
            show={gameOverStage === 'summary'} 
            winner={winner} 
            timedOutPlayer={winner === 'timeout' ? currentPlayer : null} 
            playerMark={playerMark} 
            onReset={handleGameReset} 
            onExit={onExit} 
            playerLevel={gameState.playerLevel} 
            playerXp={gameState.playerXp} 
            gameMode={gameMode}
            onlineGame={onlineGame}
            leaveCountdown={leaveCountdown}
        />

        <UndoModal 
            isOpen={isUndoModalOpen} 
            onClose={() => setIsUndoModalOpen(false)} 
            onConfirm={handleConfirmUndo}
            playSound={playSound}
        />

        <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onOpenShop={onOpenShop}
            onOpenInventory={onOpenInventory}
            onResign={resign}
        />
        <style>{`.animate-confirm-glow { animation: confirm-glow 1.5s ease-in-out infinite; } @keyframes confirm-glow { 50% { box-shadow: 0 0 15px rgba(74, 222, 128, 0.7); } } .last-move-highlight { animation: last-move-glow 2s ease-in-out infinite; } @keyframes last-move-glow { 0% { filter: drop-shadow(0 0 12px rgba(255, 255, 100, 1)) drop-shadow(0 0 6px rgba(255, 255, 100, 1)) brightness(1.5); } 10% { filter: drop-shadow(0 0 10px rgba(255, 255, 100, 0.9)); } 55% { filter: drop-shadow(0 0 4px rgba(255, 255, 100, 0.6)); } 100% { filter: drop-shadow(0 0 10px rgba(255, 255, 100, 0.9)); } } .animate-fade-in-down-then-out { animation: fade-in-down-then-out 2s cubic-bezier(0.25, 1, 0.5, 1) forwards; } @keyframes fade-in-down-then-out { 0% { transform: translateY(-50px) translateX(-50%) scale(0.8); opacity: 0; } 20% { transform: translateY(0) translateX(-50%) scale(1); opacity: 1; } 80% { transform: translateY(0) translateX(-50%) scale(1); opacity: 1; } 100% { transform: translateY(20px) translateX(-50%) scale(0.9); opacity: 0; } }`}</style>
    </div>
  );
};

export default GameScreen;
