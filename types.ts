import type React from 'react';

export type Player = 'X' | 'O';
export type CellState = Player | null;
export type BoardState = CellState[][];
export type GameMode = 'pve' | 'online';

// FIX: Added missing GameStatus type, which is used in components/GameStatus.tsx to represent the state of the game.
export type GameStatus = 'win' | 'draw' | 'in_progress';

export interface GameTheme {
  id: string;
  name: string;
  boardBg: string; // Fallback color
  boardBgImage?: string; // Image URL
  cellBg: string;
  gridColor: string;
  nameColor: string;
  decoratorComponent?: React.FC;
}

export interface PieceStyle {
  id: string;
  name: string;
  component: React.FC<{ className?: string }>;
}

export interface PieceEffect {
  id: string;
  name: string;
  component: React.FC<{ className?: string }>;
  previewComponent: React.FC;
}

export interface VictoryEffect {
  id: string;
  name: string;
  component: React.FC;
  previewComponent: React.FC;
}

export interface BoomEffect {
  id: string;
  name: string;
  component: React.FC<{ winnerCoords?: DOMRect, loserCoords?: DOMRect }>;
  previewComponent: React.FC;
}

export interface Avatar {
    id: string;
    name: string;
    url: string; // Changed from component to url for image path
}

export interface Emoji {
    id: string;
    name: string;
    emoji: string;
}

export type CosmeticType = 'theme' | 'piece' | 'avatar' | 'emoji' | 'effect' | 'victory' | 'boom';

export interface Cosmetic {
  id: string;
  name: string;
  type: CosmeticType;
  price: number;
  item: GameTheme | PieceStyle | Avatar | Emoji | PieceEffect | VictoryEffect | BoomEffect;
}

export interface BotProfile {
    id: string;
    name: string;
    avatar: string; // This is now an image URL
    level: number;
    skillLevel: 'easy' | 'medium' | 'hard';
    description: string;
}

export interface MusicTrack {
  id: string;
  name: string;
  url: string;
}

// --- Online Mode Types ---

export interface UserProfile {
    uid: string;
    name: string;
    email: string | null;
    isAnonymous: boolean;
    level: number;
    xp: number;
    coins: number;
    cp: number;
    onlineWins: number;
    onlineLosses: number;
    onlineDraws: number;
    pveWins: number;
    pveLosses: number;
    pveDraws: number;
    ownedCosmeticIds: string[];
    emojiInventory: Record<string, number>;
    activeThemeId: string;
    activePieceId: string;
    activeAvatarId: string;
    activeEffectId: string;
    activeVictoryEffectId: string;
    activeBoomEffectId: string;
}

export interface OnlinePlayer {
    uid: string;
    name: string;
    level: number;
    avatarUrl: string;
    status: 'idle' | 'in_game' | 'in_queue';
    gameId?: string | null;
    cp?: number;
}

export interface Invitation {
    from: string;
    fromName: string;
    timestamp: number;
}

export type BoardMap = Record<string, Player>; // e.g. { "0_7": "X", "1_7": "O" }

export interface OnlineGame {
    id: string;
    players: {
        X: string; // UID of player X
        O: string; // UID of player O
    };
    playerDetails: {
        [uid: string]: {
            name: string;
            avatarUrl: string;
            level: number;
            pieceId: string;
            cp: number;
        }
    };
    board: BoardMap;
    currentPlayer: Player;
    status: 'in_progress' | 'finished';
    winner: Player | 'draw' | null;
    winningLine: { row: number; col: number }[] | null;
    createdAt: number;
    updatedAt: number;
    playerTimes: {
        X: number; // seconds remaining
        O: number;
    };
    turnStartedAt: number; // timestamp
    emotes?: {
        uid: string;
        emoji: string;
        timestamp: number;
    };
    leftGame?: {
        [uid: string]: boolean;
    }
}

export interface MatchHistoryEntry {
  id: string; // gameId
  opponentName: string;
  opponentAvatarUrl: string;
  opponentCp?: number;
  result: 'win' | 'loss' | 'draw';
  cpChange: number;
  timestamp: number;
  duration: number; // in seconds
}

export interface RankInfo {
  name: string;
  cpInTier: number;
  icon: string;
}