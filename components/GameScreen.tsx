import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useGameLogic } from '../hooks/useGameLogic';
import { useOnlineGame } from '../hooks/useOnlineGame';
import { getAIMove } from '../services/aiService';
import { updateOpeningBook } from '../services/openingBook';
import * as onlineService from '../services/onlineService';
import type { Player, GameTheme, PieceStyle, BotProfile, Avatar, Emoji, PieceEffect, VictoryEffect, BoomEffect, GameMode } from '../types';
import { PIECE_STYLES, EffectStyles, VictoryAndBoomStyles, DEFAULT_PIECES_X, DEFAULT_PIECES_O, TURN_TIME } from '../constants';
import { useGameState } from '../context/GameStateContext';
import { useAuth } from '../context/AuthContext';
import { useSound } from '../hooks/useSound';

// Import sub-components
import GameBoard from './game/GameBoard';
import PlayerInfo from './game/PlayerInfo';
import GameOverScreen from './game/GameOverScreen';
import FirstMoveAnimation from './game/FirstMoveAnimation';
import SmoothTimerBar from './game/SmoothTimerBar';
import Emote from './game/Emote';
import { SettingsModal, UndoModal } from './game/GameModals';

type GameOverStage = 'none' | 'banner' | 'effects' | 'summary';

const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// --- GameScreen Main Component ---
interface GameScreenProps {
  gameMode: GameMode;
  bot?: BotProfile;
  onlineGameId?: string;
  onExit: () => void;
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

const GameScreen: React.FC<GameScreenProps> = ({ gameMode, bot, onlineGameId, onExit, theme, pieces, playerInfo, activeEffect, activeVictoryEffect, activeBoomEffect, isPaused, onOpenShop, onOpenInventory }) => {
    const { user } = useAuth();
    const { gameState, consumeEmoji, spendCoins, applyGameResult } = useGameState();
    const { playSound } = useSound();

    // --- Logic Hooks ---
    const pveLogic = useGameLogic('X', isPaused);
    const onlineLogic = useOnlineGame(gameMode === 'online' ? onlineGameId : null, user);
    const gameLogic = gameMode === 'pve' ? pveLogic : onlineLogic;

    // --- State ---
    const [aiPieceStyle, setAiPieceStyle] = useState<PieceStyle>(pieces.O);
    const [aiThinkingCell, setAiThinkingCell] = useState<{row: number, col: number} | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isEmojiPanelOpen, setEmojiPanelOpen] = useState(false);
    const [isUndoModalOpen, setIsUndoModalOpen] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [leaveCountdown, setLeaveCountdown] = useState(15);

    // Game Over Flow State
    const [gameOverStage, setGameOverStage] = useState<GameOverStage>('none');
    const [gameOverMessage, setGameOverMessage] = useState<string | null>(null);
    const [winnerPlayer, setWinnerPlayer] = useState<Player | null>(null);
    const [boomCoords, setBoomCoords] = useState<{ winner?: DOMRect; loser?: DOMRect } | null>(null);
    const isGameResultProcessedRef = useRef(false);

    // Emote State
    const [playerEmote, setPlayerEmote] = useState<{key: number, emoji: string} | null>(null);
    const [opponentEmote, setOpponentEmote] = useState<{key: number, emoji: string} | null>(null);
    
    const [hasShownFirstMove, setHasShownFirstMove] = useState(false);
    
    const handleOnlineFirstMoveEnd = useCallback(() => {
        setHasShownFirstMove(true);
    }, []);
    
    // --- Refs ---
    const isAiThinkingRef = useRef(false);
    const playerAvatarRef = useRef<HTMLDivElement>(null);
    const opponentAvatarRef = useRef<HTMLDivElement>(null);
    const hasLoadedOnlineGame = useRef(false);
    const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);


    // --- Destructure from active logic hook ---
    const { board, currentPlayer, winner, isGameOver, winningLine, isDecidingFirst, gameId, playerMark, makeMove, resign, lastMove } = gameLogic;
    const { totalGameTime: pveTotalGameTime } = pveLogic;
    const { onlineGameData, isLoading: isLoadingOnlineGame, opponentEmote: onlineOpponentEmote, activePlayerTime, turnTimeLeft: onlineTurnTimeLeft } = onlineLogic;
    
    // Set a ref once the game data has been successfully loaded at least once.
    if (onlineGameData) {
        hasLoadedOnlineGame.current = true;
    }

    // --- Effects ---
    
    // This cleanup effect is crucial for preventing race conditions when leaving an online game.
    useEffect(() => {
        if (gameMode === 'online' && onlineGameId && user) {
            // This is the cleanup function that will run when the component unmounts
            // because the key changes or the view switches.
            return () => {
                onlineService.leaveOnlineGame(onlineGameId, user.uid);
            };
        }
    }, [gameMode, onlineGameId, user]);
    
    useEffect(() => {
        isGameResultProcessedRef.current = false;
        setGameOverStage('none');
        setGameOverMessage(null);
        setWinnerPlayer(null);
        setHasShownFirstMove(false);
    }, [gameId, onlineGameId]);
    
    // Countdown timer for automatically leaving the game over screen.
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
    
    useEffect(() => {
        if (lastMove) playSound('move');
    }, [lastMove, playSound]);

    useEffect(() => {
        if (gameMode === 'online' && onlineOpponentEmote) {
            setOpponentEmote(onlineOpponentEmote);
        }
    }, [onlineOpponentEmote, gameMode]);

    useEffect(() => {
        if (gameMode === 'online' && onlineGameId && user && gameState.activePieceX?.id) {
            onlineService.updatePlayerPieceSkin(onlineGameId, user.uid, gameState.activePieceX.id);
        }
    }, [gameState.activePieceX?.id, gameMode, onlineGameId, user]);

    const isOnlineGameOverSequenceActive = gameOverStage !== 'none';
    useEffect(() => {
        if (gameMode === 'online' && hasLoadedOnlineGame.current && !isLoadingOnlineGame && !onlineGameData && !isOnlineGameOverSequenceActive) {
            onExit();
        }
    }, [gameMode, isLoadingOnlineGame, onlineGameData, onExit, isOnlineGameOverSequenceActive]);

    // PVE Logic
    useEffect(() => {
        if (gameMode === 'pve' && isDecidingFirst) {
            const randomPiece = PIECE_STYLES[Math.floor(Math.random() * PIECE_STYLES.length)];
            setAiPieceStyle(randomPiece);
        }
    }, [gameMode, isDecidingFirst]);

    useEffect(() => {
        const opponentMark = playerMark === 'X' ? 'O' : 'X';
        if (gameMode !== 'pve' || isPaused || isDecidingFirst || isGameOver || currentPlayer !== opponentMark || !bot || isAiThinkingRef.current) {
            if (currentPlayer !== opponentMark) isAiThinkingRef.current = false;
            return;
        }
        isAiThinkingRef.current = true;
        if (Math.random() < 0.15) setTimeout(() => setOpponentEmote({ key: Date.now(), emoji: onlineService.getRandomEmoji().emoji }), 500);
        
        getAIMove(board, opponentMark, bot.skillLevel, (move) => setAiThinkingCell(move))
            .then(({ row, col }) => {
                if (row !== -1 && !isGameOver && currentPlayer === opponentMark) {
                    setAiThinkingCell(null);
                    pveLogic.makeMove(row, col);
                }
            }).finally(() => {
                isAiThinkingRef.current = false;
                setAiThinkingCell(null);
            });
    }, [currentPlayer, isGameOver, board, isPaused, isDecidingFirst, bot, gameMode, pveLogic, playerMark]);

    // Game Over Flow
    useEffect(() => {
        if (isGameOver && winner && !isGameResultProcessedRef.current) {
            isGameResultProcessedRef.current = true;
            const result = winner === playerMark ? 'win' : winner === 'draw' ? 'draw' : 'loss';
            const opponentId = gameMode === 'pve' ? bot!.id : (onlineGameData?.players.X === user?.uid ? onlineGameData?.players.O : onlineGameData?.players.X) || 'unknown';
            applyGameResult(result, opponentId, gameId);
            
            if (result === 'win') { playSound('win'); playSound('announce_win'); setGameOverMessage('You Win!'); } 
            else if (result === 'loss') { playSound('lose'); playSound('announce_lose'); setGameOverMessage('You Lose!'); }
            else { setGameOverMessage(winner === 'timeout' ? 'Time Out!' : 'Draw!'); }

            if (gameMode === 'pve' && winner !== playerMark && result !== 'draw') updateOpeningBook(pveLogic.moveHistory);

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
    }, [isGameOver, winner, playerMark, applyGameResult, bot, gameId, gameMode, onlineGameData, user, pveLogic.moveHistory, playSound]);
    
    const opponentInfo = useMemo(() => {
        if (gameMode === 'online' && onlineGameData && user) {
            const opponentUid = onlineGameData.players.X === user.uid ? onlineGameData.players.O : onlineGameData.players.X;
            const details = onlineGameData.playerDetails[opponentUid];
            return { name: details?.name || 'Opponent', avatar: details?.avatarUrl || 'assets/avatars/avatar_1.png', level: details?.level || 1 };
        }
        if (gameMode === 'pve' && bot) {
            return { name: bot.name, avatar: bot.avatar, level: bot.level, skillLevel: bot.skillLevel };
        }
        return { name: 'Player', avatar: '', level: 1 };
    }, [gameMode, onlineGameData, user, bot]);

    const allPieces = useMemo(() => {
        if (gameMode === 'pve') return { X: pieces.X, O: aiPieceStyle };
        if (gameMode === 'online' && onlineGameData && user) {
            const playerUid = user.uid;
            const opponentUid = onlineGameData.players.X === playerUid ? onlineGameData.players.O : onlineGameData.players.X;
            const playerPiece = pieces.X; // Live equipped piece
            const opponentPieceId = onlineGameData.playerDetails[opponentUid]?.pieceId || DEFAULT_PIECES_X.id;
            const allPieceStyles = [DEFAULT_PIECES_X, DEFAULT_PIECES_O, ...PIECE_STYLES];
            const opponentPiece = allPieceStyles.find(p => p.id === opponentPieceId) || DEFAULT_PIECES_X;
            return onlineGameData.players.X === playerUid ? { X: playerPiece, O: opponentPiece } : { X: opponentPiece, O: playerPiece };
        }
        return pieces;
    }, [gameMode, onlineGameData, user, pieces, aiPieceStyle]);

    const botStats = gameState.botStats[bot?.id || ''] || { wins: 0, losses: 0, draws: 0 };
    const ownedEmojis = useMemo(() => onlineService.getOwnedEmojis(gameState.ownedCosmeticIds, gameState.emojiInventory), [gameState.ownedCosmeticIds, gameState.emojiInventory]);

    const handleCellClick = (row: number, col: number) => {
        if (isGameOver || currentPlayer !== playerMark || board[row][col] !== null) return;
        makeMove(row, col);
    };
    
    const handleUndoClick = () => { if (pveLogic.canUndo && gameState.coins >= 20) setIsUndoModalOpen(true); };
    const handleConfirmUndo = () => { if (spendCoins(20)) pveLogic.undoMove(); setIsUndoModalOpen(false); };
    
    const handleSendEmoji = (emoji: Emoji) => {
        playSound('select');
        setPlayerEmote({ key: Date.now(), emoji: emoji.emoji });
        consumeEmoji(emoji.id);
        setEmojiPanelOpen(false);
        if (gameMode === 'online') onlineLogic.sendEmote(emoji.emoji);
    };

    const handleGameReset = useCallback(() => {
        playSound('select');
        setGameOverStage('none');
        setGameOverMessage(null);
        setWinnerPlayer(null);
        isGameResultProcessedRef.current = false;
        if (gameMode === 'pve') pveLogic.resetGameForRematch();
    }, [pveLogic, gameMode, playSound]);

    const handleCopyGameId = () => {
        if (gameId) {
            navigator.clipboard.writeText(gameId);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }
    }
    
    const DecoratorComponent = theme.decoratorComponent;
    const VictoryComponent = activeVictoryEffect.component;
    const BoomComponent = activeBoomEffect.component;
    
    const shouldShowFirstMoveAnimation = (gameMode === 'pve' && isDecidingFirst) || (gameMode === 'online' && onlineGameData && Object.keys(onlineGameData.board).length === 0 && !isGameOver && !hasShownFirstMove);

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
    
    const displayedTime = gameMode === 'pve' ? pveTotalGameTime : activePlayerTime;
    const turnTimeLeft = gameMode === 'pve' ? pveLogic.turnTimeLeft : onlineTurnTimeLeft;
    const gameIdToDisplay = gameMode === 'online' && gameId ? `Room: ${gameId.split('_').pop()?.substring(0, 6)}` : null;

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
                    {gameMode === 'pve' && <button onClick={handleUndoClick} disabled={!pveLogic.canUndo || gameState.coins < 20} className="relative bg-slate-800/80 p-2 rounded-full hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Undo"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8a5 5 0 000-10H9"></path></svg></button>}
                    <button onClick={() => { playSound('select'); setEmojiPanelOpen(p => !p); }} className="bg-slate-800/80 p-2 rounded-full hover:bg-slate-700 transition-colors" aria-label="Emotes"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                    {isEmojiPanelOpen && ( <div className="absolute top-full mt-4 bg-slate-800/90 backdrop-blur-sm p-2 rounded-lg flex flex-wrap justify-center gap-2 animate-fade-in-down z-30" style={{width: '280px'}} onMouseLeave={() => setEmojiPanelOpen(false)}> {ownedEmojis.map(e => <button key={e.id} onClick={() => handleSendEmoji(e)} className="text-3xl w-12 h-12 flex items-center justify-center rounded-md hover:bg-slate-700/50 hover:scale-110 transition-all">{e.emoji}</button>)} </div> )}
                </div>
            </header>

            <main className="flex-grow flex flex-col justify-center relative">
                 {gameOverStage === 'banner' && gameOverMessage && (<div className="absolute top-28 left-1/2 -translate-x-1/2 w-max px-8 py-4 bg-slate-900/80 border border-slate-700 rounded-2xl shadow-lg z-30 pointer-events-none animate-fade-in-down-then-out"><h2 className={`text-5xl font-black ${ gameOverMessage.includes('Win') ? 'text-green-400' : gameOverMessage.includes('Lose') ? 'text-red-500' : 'text-yellow-400' }`} style={{ textShadow: '0 0 15px currentColor' }}>{gameOverMessage}</h2></div>)}
                 
                 <div className="flex justify-between items-end px-2 mb-[4px] -mt-px">
                    <PlayerInfo ref={playerAvatarRef} name={playerInfo.name} avatar={playerInfo.avatar.url} level={playerInfo.level} align="left" player={playerMark} isCurrent={currentPlayer === playerMark} piece={allPieces[playerMark]} />
                    <div className="text-center pb-1 text-shadow">
                        {gameIdToDisplay && (
                            <div className="text-xs text-slate-400 font-mono mb-1 cursor-pointer" title="Click to copy full Game ID" onClick={handleCopyGameId}>
                                {copySuccess ? 'Copied!' : gameIdToDisplay}
                            </div>
                        )}
                        {gameMode === 'pve' && bot && <div className="text-white font-mono text-xs tracking-wider whitespace-nowrap" title={`vs ${bot.name}`}><span className="text-green-400">Win {botStats.wins}</span> - <span className="text-red-400">Lose {botStats.losses}</span></div>}
                         <div className="text-white font-mono text-2xl tracking-wider">{formatTime(displayedTime)}</div>
                    </div>
                    <PlayerInfo ref={opponentAvatarRef} name={opponentInfo.name} avatar={opponentInfo.avatar} level={opponentInfo.level} align="right" player={playerMark === 'X' ? 'O' : 'X'} isCurrent={currentPlayer !== playerMark} piece={allPieces[playerMark === 'X' ? 'O' : 'X']} skillLevel={gameMode === 'pve' ? bot?.skillLevel : undefined} />
                </div>
                <div className="w-full mx-auto">
                    {/* FIX: Removed unsupported 'time' prop. The component uses its own internal timer. */}
                    <SmoothTimerBar
                        key={`${gameId}-${currentPlayer}`}
                        duration={TURN_TIME}
                        isPaused={isPaused}
                        isGameOver={isGameOver}
                        isDecidingFirst={isDecidingFirst || shouldShowFirstMoveAnimation}
                        time={turnTimeLeft}
                    />
                    <div className="mt-px relative bg-black/40 backdrop-blur-lg rounded-xl p-2 border border-white/10 shadow-lg">
                        <GameBoard board={board} onCellClick={handleCellClick} winningLine={winningLine} pieces={allPieces} aiThinkingCell={aiThinkingCell} theme={theme} lastMove={lastMove} effect={activeEffect} />
                        {shouldShowFirstMoveAnimation && (
                            <FirstMoveAnimation 
                                pieces={allPieces} 
                                onAnimationEnd={gameMode === 'pve' ? pveLogic.beginGame : handleOnlineFirstMoveEnd}
                                playerMark={playerMark} 
                                playSound={playSound} 
                                gameMode={gameMode} 
                                forcedWinner={gameMode === 'online' ? onlineGameData?.currentPlayer : null}
                                playerInfo={playerInfo} 
                                opponentInfo={opponentInfo} 
                            />
                        )}
                    </div>
                </div>
            </main>
        </div>
        
        {gameOverStage === 'effects' && winnerPlayer && boomCoords && ( <><VictoryComponent /> <BoomComponent winnerCoords={boomCoords?.winner} loserCoords={boomCoords?.loser} /></>)}

        <GameOverScreen 
            show={gameOverStage === 'summary'} 
            winner={winner} 
            timedOutPlayer={winner === 'timeout' ? (currentPlayer === playerMark ? (playerMark === 'X' ? 'O' : 'X') : currentPlayer) : null} 
            playerMark={playerMark} 
            onReset={handleGameReset} 
            onExit={() => onExit()}
            playerLevel={gameState.playerLevel} 
            playerXp={gameState.playerXp} 
            gameMode={gameMode}
            onlineGame={onlineGameData}
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
