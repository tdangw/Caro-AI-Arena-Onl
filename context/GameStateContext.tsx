import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import type { Cosmetic, GameTheme, PieceStyle, Avatar, PieceEffect, VictoryEffect, BoomEffect, UserProfile, CosmeticType } from '../types';
import { DEFAULT_THEME, DEFAULT_PIECES_X, DEFAULT_PIECES_O, DEFAULT_AVATAR, getXpForNextLevel, THEMES, PIECE_STYLES, AVATARS, PIECE_EFFECTS, VICTORY_EFFECTS, BOOM_EFFECTS, DEFAULT_EFFECT, DEFAULT_VICTORY_EFFECT, DEFAULT_BOOM_EFFECT, ALL_COSMETICS, MUSIC_TRACKS, COIN_REWARD, XP_REWARD } from '../constants';
import { useAuth } from './AuthContext';
import * as onlineService from '../services/onlineService';
import { updateProfile } from 'firebase/auth';

const DEFAULT_EMOJI_IDS = ALL_COSMETICS.filter(c => c.type === 'emoji' && c.price === 0).map(c => c.id);
const LOCAL_STORAGE_KEY = 'caroGameState_v9_guest'; // Renamed to avoid conflicts

interface GameState {
  coins: number;
  playerName: string;
  pveWins: number;
  pveLosses: number;
  pveDraws: number;
  onlineWins: number;
  onlineLosses: number;
  onlineDraws: number;
  playerLevel: number;
  playerXp: number;
  ownedCosmeticIds: string[];
  emojiInventory: Record<string, number>;
  botStats: Record<string, { wins: number; losses: number; draws: number; }>;
  activeTheme: GameTheme;
  activePieceX: PieceStyle;
  activePieceO: PieceStyle;
  activeAvatar: Avatar;
  activeEffect: PieceEffect;
  activeVictoryEffect: VictoryEffect;
  activeBoomEffect: BoomEffect;
  isSoundOn: boolean;
  isMusicOn: boolean;
  soundVolume: number;
  musicVolume: number;
  activeMusicUrl: string;
  lastProcessedGameId: string | null;
}

interface GameStateContextType {
  gameState: GameState;
  setPlayerName: (name: string) => void;
  applyGameResult: (result: 'win' | 'loss' | 'draw', opponentId: string, gameId: string | null) => void;
  spendCoins: (amount: number) => boolean;
  purchaseCosmetic: (cosmetic: Cosmetic) => boolean;
  consumeEmoji: (emojiId: string) => void;
  equipTheme: (theme: GameTheme) => void;
  equipPiece: (piece: PieceStyle) => void;
  equipAvatar: (avatar: Avatar) => void;
  equipEffect: (effect: PieceEffect) => void;
  equipVictoryEffect: (effect: VictoryEffect) => void;
  equipBoomEffect: (effect: BoomEffect) => void;
  toggleSound: () => void;
  toggleMusic: () => void;
  setSoundVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  equipMusic: (musicUrl: string) => void;
}

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

const sanitizeCosmetic = (cosmetic: any) => {
    if (!cosmetic) return null;
    const { component, previewComponent, decoratorComponent, ...rest } = cosmetic;
    return rest;
};

const createDefaultGameState = (): GameState => ({
  coins: 500,
  playerName: `Player_${Math.floor(1000 + Math.random() * 9000)}`,
  pveWins: 0,
  pveLosses: 0,
  pveDraws: 0,
  onlineWins: 0,
  onlineLosses: 0,
  onlineDraws: 0,
  playerLevel: 1,
  playerXp: 0,
  ownedCosmeticIds: [DEFAULT_THEME.id, DEFAULT_PIECES_X.id, DEFAULT_PIECES_O.id, DEFAULT_AVATAR.id, DEFAULT_EFFECT.id, DEFAULT_VICTORY_EFFECT.id, DEFAULT_BOOM_EFFECT.id, ...DEFAULT_EMOJI_IDS],
  emojiInventory: {},
  botStats: {},
  activeTheme: DEFAULT_THEME,
  activePieceX: DEFAULT_PIECES_X,
  activePieceO: DEFAULT_PIECES_O,
  activeAvatar: DEFAULT_AVATAR,
  activeEffect: DEFAULT_EFFECT,
  activeVictoryEffect: DEFAULT_VICTORY_EFFECT,
  activeBoomEffect: DEFAULT_BOOM_EFFECT,
  isSoundOn: true,
  isMusicOn: true,
  soundVolume: 1,
  musicVolume: 1,
  activeMusicUrl: MUSIC_TRACKS[0].url,
  lastProcessedGameId: null,
});

const loadGuestState = (): GameState => {
  try {
    const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedState) {
        const parsed = JSON.parse(savedState);
        
        // Re-hydrate all cosmetic items with their full definitions from constants
        const allPieces = [DEFAULT_PIECES_X, DEFAULT_PIECES_O, ...PIECE_STYLES];
        const allAvatars = [DEFAULT_AVATAR, ...AVATARS];
        const allEffects = [DEFAULT_EFFECT, ...PIECE_EFFECTS];
        const allVictoryEffects = [DEFAULT_VICTORY_EFFECT, ...VICTORY_EFFECTS];
        const allBoomEffects = [DEFAULT_BOOM_EFFECT, ...BOOM_EFFECTS];

        const activeTheme = THEMES.find(t => t.id === parsed.activeTheme?.id) || DEFAULT_THEME;
        const activePieceX = allPieces.find(p => p.id === parsed.activePieceX?.id) || DEFAULT_PIECES_X;
        const activePieceO = allPieces.find(p => p.id === parsed.activePieceO?.id) || DEFAULT_PIECES_O;
        const activeAvatar = allAvatars.find(a => a.id === parsed.activeAvatar?.id) || DEFAULT_AVATAR;
        const activeEffect = allEffects.find(e => e.id === parsed.activeEffect?.id) || DEFAULT_EFFECT;
        const activeVictory = allVictoryEffects.find(v => v.id === parsed.activeVictoryEffect?.id) || DEFAULT_VICTORY_EFFECT;
        const activeBoom = allBoomEffects.find(b => b.id === parsed.activeBoomEffect?.id) || DEFAULT_BOOM_EFFECT;
        
        // Backward compatibility for old stats
        const pveWins = parsed.pveWins ?? parsed.wins ?? 0;
        const pveLosses = parsed.pveLosses ?? parsed.losses ?? 0;
        const pveDraws = parsed.pveDraws ?? parsed.draws ?? 0;

        return {
            ...createDefaultGameState(),
            ...parsed,
            pveWins,
            pveLosses,
            pveDraws,
            onlineWins: parsed.onlineWins ?? 0,
            onlineLosses: parsed.onlineLosses ?? 0,
            onlineDraws: parsed.onlineDraws ?? 0,
            activeTheme,
            activePieceX,
            activePieceO,
            activeAvatar,
            activeEffect,
            activeVictoryEffect: activeVictory,
            activeBoomEffect: activeBoom
        };
    }
  } catch (error) { console.error("Failed to parse guest state", error); }
  return createDefaultGameState();
}

export const GameStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [gameState, setGameState] = useState<GameState>(loadGuestState);
  const [isFirebaseLoaded, setIsFirebaseLoaded] = useState(false);

  // Effect to load data from Firebase when user logs in
  useEffect(() => {
    if (user) {
        setIsFirebaseLoaded(false);
        onlineService.getUserProfile(user.uid).then(profile => {
            if (profile) {
                // Hydrate state from Firebase profile
                const activeTheme = THEMES.find(t => t.id === profile.activeThemeId) || DEFAULT_THEME;
                const activePiece = PIECE_STYLES.find(p => p.id === profile.activePieceId) || DEFAULT_PIECES_X;
                const activeAvatar = AVATARS.find(a => a.id === profile.activeAvatarId) || DEFAULT_AVATAR;
                const activeEffect = PIECE_EFFECTS.find(e => e.id === profile.activeEffectId) || DEFAULT_EFFECT;
                const activeVictory = VICTORY_EFFECTS.find(v => v.id === profile.activeVictoryEffectId) || DEFAULT_VICTORY_EFFECT;
                const activeBoom = BOOM_EFFECTS.find(b => b.id === profile.activeBoomEffectId) || DEFAULT_BOOM_EFFECT;
                
                setGameState(prev => ({
                    ...prev,
                    playerName: profile.name,
                    coins: profile.coins,
                    onlineWins: profile.onlineWins,
                    onlineLosses: profile.onlineLosses,
                    onlineDraws: profile.onlineDraws,
                    pveWins: profile.pveWins,
                    pveLosses: profile.pveLosses,
                    pveDraws: profile.pveDraws,
                    playerLevel: profile.level,
                    playerXp: profile.xp,
                    ownedCosmeticIds: profile.ownedCosmeticIds,
                    emojiInventory: profile.emojiInventory,
                    activeTheme,
                    activePieceX: activePiece,
                    activePieceO: activePiece,
                    activeAvatar,
                    activeEffect,
                    activeVictoryEffect: activeVictory,
                    activeBoomEffect: activeBoom
                }));
                 // FIX: Added profile.name as the fourth argument to match the function signature.
                 onlineService.setupPresenceSystem(user, profile.level, activeAvatar.url, profile.name);
            } else {
                // This is a new user (likely a guest) with no profile. Create one.
                const newProfileName = gameState.playerName; // Use name from local/default state
                onlineService.createUserProfile(user, newProfileName);
                updateProfile(user, { displayName: newProfileName }); // Sync to Auth profile too
                // FIX: Added newProfileName as the fourth argument to match the function signature.
                onlineService.setupPresenceSystem(user, gameState.playerLevel, gameState.activeAvatar.url, newProfileName);
            }
        }).finally(() => setIsFirebaseLoaded(true));
    } else {
        // User logged out, reset to guest state
        setIsFirebaseLoaded(false);
        setGameState(loadGuestState());
    }
  }, [user]);

  // Effect to save state
  useEffect(() => {
    if (user) {
        // Save to Firebase for logged-in users
        if (!isFirebaseLoaded) return; // Don't save incomplete data
        const profileToSave: Partial<UserProfile> = {
            name: gameState.playerName,
            coins: gameState.coins,
            onlineWins: gameState.onlineWins,
            onlineLosses: gameState.onlineLosses,
            onlineDraws: gameState.onlineDraws,
            pveWins: gameState.pveWins,
            pveLosses: gameState.pveLosses,
            pveDraws: gameState.pveDraws,
            level: gameState.playerLevel,
            xp: gameState.playerXp,
            ownedCosmeticIds: gameState.ownedCosmeticIds,
            emojiInventory: gameState.emojiInventory,
            activeThemeId: gameState.activeTheme.id,
            activePieceId: gameState.activePieceX.id,
            activeAvatarId: gameState.activeAvatar.id,
            activeEffectId: gameState.activeEffect.id,
            activeVictoryEffectId: gameState.activeVictoryEffect.id,
            activeBoomEffectId: gameState.activeBoomEffect.id
        };
        onlineService.updateUserProfile(user.uid, profileToSave);
    } else {
        // Save to localStorage for guests
        try {
            const stateToSave = { 
                ...gameState,
                // Sanitize all cosmetics to remove non-serializable component functions
                activeTheme: sanitizeCosmetic(gameState.activeTheme),
                activePieceX: sanitizeCosmetic(gameState.activePieceX),
                activePieceO: sanitizeCosmetic(gameState.activePieceO),
                activeAvatar: sanitizeCosmetic(gameState.activeAvatar),
                activeEffect: sanitizeCosmetic(gameState.activeEffect),
                activeVictoryEffect: sanitizeCosmetic(gameState.activeVictoryEffect),
                activeBoomEffect: sanitizeCosmetic(gameState.activeBoomEffect),
            };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (error) { console.error("Failed to save guest state", error); }
    }
  }, [gameState, user, isFirebaseLoaded]);
  
  const setPlayerName = useCallback((name: string) => {
    if(user) {
        onlineService.updateAuthAndProfileName(user, name);
    }
    setGameState(prev => ({...prev, playerName: name}));
  }, [user]);

  const spendCoins = useCallback((amount: number): boolean => {
    if (gameState.coins < amount) return false;
    setGameState(prev => ({...prev, coins: prev.coins - amount}));
    return true;
  }, [gameState.coins]);
  
  const applyGameResult = useCallback((result: 'win' | 'loss' | 'draw', opponentId: string, gameId: string | null) => {
    setGameState(prev => {
        if (gameId && prev.lastProcessedGameId === gameId) return prev;

        const xpToAdd = XP_REWARD[result];
        const coinsToAdd = COIN_REWARD[result];

        let newXp = prev.playerXp + xpToAdd;
        let newLevel = prev.playerLevel;
        let xpNeeded = getXpForNextLevel(newLevel);
        while (newXp >= xpNeeded) {
            newXp -= xpNeeded;
            newLevel++;
            xpNeeded = getXpForNextLevel(newLevel);
        }

        const isPVE = opponentId.startsWith('bot_');
        const newBotStats = { ...prev.botStats };
        if (isPVE) {
            if (!newBotStats[opponentId]) newBotStats[opponentId] = { wins: 0, losses: 0, draws: 0 };
            if (result === 'win') newBotStats[opponentId].wins++;
            else if (result === 'draw') newBotStats[opponentId].draws++;
            else newBotStats[opponentId].losses++;
        }

        return {
            ...prev,
            coins: prev.coins + coinsToAdd,
            playerXp: newXp,
            playerLevel: newLevel,
            pveWins: isPVE && result === 'win' ? prev.pveWins + 1 : prev.pveWins,
            pveLosses: isPVE && result === 'loss' ? prev.pveLosses + 1 : prev.pveLosses,
            pveDraws: isPVE && result === 'draw' ? prev.pveDraws + 1 : prev.pveDraws,
            onlineWins: !isPVE && result === 'win' ? prev.onlineWins + 1 : prev.onlineWins,
            onlineLosses: !isPVE && result === 'loss' ? prev.onlineLosses + 1 : prev.onlineLosses,
            onlineDraws: !isPVE && result === 'draw' ? prev.onlineDraws + 1 : prev.onlineDraws,
            botStats: newBotStats,
            lastProcessedGameId: gameId || prev.lastProcessedGameId,
        };
    });
}, []);
  
  const consumeEmoji = useCallback((emojiId: string) => {
    if (DEFAULT_EMOJI_IDS.includes(emojiId)) return;
    setGameState(prev => {
        const newInventory = { ...prev.emojiInventory };
        if (newInventory[emojiId] > 0) {
            newInventory[emojiId] -= 1;
            if (newInventory[emojiId] === 0) delete newInventory[emojiId];
        }
        return { ...prev, emojiInventory: newInventory };
    });
  }, []);

  const equipCosmetic = useCallback((type: CosmeticType, item: any) => {
    if (!gameState.ownedCosmeticIds.includes(item.id)) return;
    setGameState(prev => {
        switch(type) {
            case 'theme': return { ...prev, activeTheme: item };
            case 'piece': return { ...prev, activePieceX: item, activePieceO: item };
            case 'avatar': return { ...prev, activeAvatar: item };
            case 'effect': return { ...prev, activeEffect: item };
            case 'victory': return { ...prev, activeVictoryEffect: item };
            case 'boom': return { ...prev, activeBoomEffect: item };
            default: return prev;
        }
    });
  }, [gameState.ownedCosmeticIds]);

  const purchaseCosmetic = useCallback((cosmetic: Cosmetic): boolean => {
    if (gameState.coins < cosmetic.price) return false;

    if (cosmetic.type === 'emoji' && cosmetic.price > 0) {
        setGameState(prev => {
            const newInventory = { ...prev.emojiInventory };
            newInventory[cosmetic.id] = (newInventory[cosmetic.id] || 0) + 1;
            return { ...prev, coins: prev.coins - cosmetic.price, emojiInventory: newInventory };
        });
        return true;
    }
    
    if (!gameState.ownedCosmeticIds.includes(cosmetic.id)) {
      setGameState(prev => ({
        ...prev,
        coins: prev.coins - cosmetic.price,
        ownedCosmeticIds: [...prev.ownedCosmeticIds, cosmetic.id],
      }));
      equipCosmetic(cosmetic.type, cosmetic.item);
      return true;
    }
    return false;
  }, [gameState.coins, gameState.ownedCosmeticIds, gameState.emojiInventory, equipCosmetic]);

  const toggleSound = useCallback(() => setGameState(prev => ({ ...prev, isSoundOn: !prev.isSoundOn })), []);
  const toggleMusic = useCallback(() => setGameState(prev => ({ ...prev, isMusicOn: !prev.isMusicOn })), []);
  const setSoundVolume = useCallback((volume: number) => setGameState(prev => ({...prev, soundVolume: volume})), []);
  const setMusicVolume = useCallback((volume: number) => setGameState(prev => ({...prev, musicVolume: volume})), []);
  const equipMusic = useCallback((musicUrl: string) => setGameState(prev => ({ ...prev, activeMusicUrl: musicUrl })), []);

  return (
    <GameStateContext.Provider value={{ 
        gameState, setPlayerName, applyGameResult, spendCoins, purchaseCosmetic, consumeEmoji, 
        equipTheme: (item) => equipCosmetic('theme', item),
        equipPiece: (item) => equipCosmetic('piece', item),
        equipAvatar: (item) => equipCosmetic('avatar', item),
        equipEffect: (item) => equipCosmetic('effect', item),
        equipVictoryEffect: (item) => equipCosmetic('victory', item),
        equipBoomEffect: (item) => equipCosmetic('boom', item),
        toggleSound, toggleMusic, setSoundVolume, setMusicVolume, equipMusic 
    }}>
      {children}
    </GameStateContext.Provider>
  );
};

export const useGameState = (): GameStateContextType => {
  const context = useContext(GameStateContext);
  if (!context) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
};