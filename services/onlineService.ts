import { auth, db, rtdb } from '../firebaseConfig';
import { 
    doc, 
    setDoc, 
    getDoc, 
    getDocs,
    updateDoc, 
    onSnapshot, 
    collection, 
    query,
    deleteDoc,
    serverTimestamp,
    limit,
    writeBatch,
    where
} from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtdbServerTimestamp, get } from "firebase/database";
import { User, updateProfile } from 'firebase/auth';
import type { UserProfile, OnlinePlayer, BoardState, Player, Invitation, OnlineGame, BoardMap, Avatar, Emoji } from '../types';
import { DEFAULT_THEME, DEFAULT_PIECES_X, DEFAULT_AVATAR, DEFAULT_EFFECT, DEFAULT_VICTORY_EFFECT, DEFAULT_BOOM_EFFECT, ALL_COSMETICS, BOARD_SIZE, WINNING_LENGTH, EMOJIS, INITIAL_GAME_TIME, TURN_TIME } from '../constants';

const DEFAULT_EMOJI_IDS = ALL_COSMETICS.filter(c => c.type === 'emoji' && c.price === 0).map(c => c.id);

// --- Board Conversion Utilities ---
export const boardToMap = (board: BoardState): BoardMap => {
    const map: BoardMap = {};
    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
            if (board[r][c]) {
                map[`${r}_${c}`] = board[r][c] as Player;
            }
        }
    }
    return map;
};

export const mapToBoard = (map: BoardMap): BoardState => {
    const board: BoardState = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    for (const key in map) {
        const [r, c] = key.split('_').map(Number);
        board[r][c] = map[key];
    }
    return board;
};

export const getLastMove = (oldBoard: BoardState, newBoard: BoardState): { row: number, col: number } | null => {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (oldBoard[r][c] === null && newBoard[r][c] !== null) {
                return { row: r, col: c };
            }
        }
    }
    return null;
};

const checkWin = (board: BoardState, player: Player): { row: number; col: number }[] | null => {
    const directions = [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: -1 }];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === player) {
                for (const dir of directions) {
                    const line = [];
                    for (let i = 0; i < WINNING_LENGTH; i++) {
                        const newR = r + i * dir.r;
                        const newC = c + i * dir.c;
                        if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && board[newR][newC] === player) {
                            line.push({ row: newR, col: newC });
                        } else {
                            break;
                        }
                    }
                    if (line.length === WINNING_LENGTH) return line;
                }
            }
        }
    }
    return null;
};

export const getOwnedEmojis = (ownedIds: string[], inventory: Record<string, number>): Emoji[] => {
    const ownedEmojiIds = new Set(ownedIds.filter(id => id.startsWith('emoji_')));
    for (const emojiId in inventory) {
        if (inventory[emojiId] > 0) {
            ownedEmojiIds.add(emojiId);
        }
    }
    return EMOJIS.filter(emoji => ownedEmojiIds.has(emoji.id));
};

export const getRandomEmoji = (): Emoji => {
    // Select from a subset of non-negative emojis to avoid AI being toxic
    const safeEmojis = EMOJIS.filter(e => !['😠', '😭', '💀', '🤡'].includes(e.emoji));
    return safeEmojis[Math.floor(Math.random() * safeEmojis.length)];
};

// --- User Profile Management ---
export const createUserProfile = async (user: User, name: string): Promise<void> => {
    const userRef = doc(db, 'users', user.uid);
    const userProfile: UserProfile = {
        uid: user.uid,
        name,
        email: user.email,
        isAnonymous: user.isAnonymous,
        level: 1,
        xp: 0,
        coins: 500,
        cp: 0,
        onlineWins: 0,
        onlineLosses: 0,
        onlineDraws: 0,
        pveWins: 0,
        pveLosses: 0,
        pveDraws: 0,
        ownedCosmeticIds: [DEFAULT_THEME.id, DEFAULT_PIECES_X.id, DEFAULT_AVATAR.id, DEFAULT_EFFECT.id, DEFAULT_VICTORY_EFFECT.id, DEFAULT_BOOM_EFFECT.id, ...DEFAULT_EMOJI_IDS],
        emojiInventory: {},
        activeThemeId: DEFAULT_THEME.id,
        activePieceId: DEFAULT_PIECES_X.id,
        activeAvatarId: DEFAULT_AVATAR.id,
        activeEffectId: DEFAULT_EFFECT.id,
        activeVictoryEffectId: DEFAULT_VICTORY_EFFECT.id,
        activeBoomEffectId: DEFAULT_BOOM_EFFECT.id,
    };
    await setDoc(userRef, userProfile);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    const userRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userRef);
    return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, data, { merge: true });
};

export const updateAuthAndProfileName = async (user: User, name: string) => {
    await updateProfile(user, { displayName: name });
    await updateUserProfile(user.uid, { name });

    const onlineUserRef = doc(db, 'onlineUsers', user.uid);
    try {
        const onlineUserSnap = await getDoc(onlineUserRef);
        if (onlineUserSnap.exists()) {
            await updateDoc(onlineUserRef, { name });
        }
    } catch(e) {
        console.warn("Could not update online user name, document may not exist yet.");
    }
}

// --- Presence System ---
export const setupPresenceSystem = async (user: User, level: number, avatarUrl: string, name: string) => {
    const uid = user.uid;
    const userStatusDatabaseRef = ref(rtdb, `/status/${uid}`);
    const userStatusFirestoreRef = doc(db, 'onlineUsers', uid);

    const docSnap = await getDoc(userStatusFirestoreRef);
    const currentStatus = docSnap.exists() ? docSnap.data().status : 'idle';

    if (currentStatus === 'in_game' || currentStatus === 'in_queue') {
        onValue(ref(rtdb, '.info/connected'), (snapshot) => {
            if (snapshot.val() === false) return;
            onDisconnect(userStatusDatabaseRef).set({ state: 'offline', last_changed: rtdbServerTimestamp() }).then(() => {
                set(userStatusDatabaseRef, { state: 'online', last_changed: rtdbServerTimestamp() });
            });
        });
        console.log(`Presence system: User is '${currentStatus}'. Preserving status.`);
        return;
    }

    const isOnlineForDatabase = { state: 'online', last_changed: rtdbServerTimestamp() };
    const isOfflineForDatabase = { state: 'offline', last_changed: rtdbServerTimestamp() };

    onValue(ref(rtdb, '.info/connected'), (snapshot) => {
        if (snapshot.val() === false) {
            return;
        }

        onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase).then(async () => {
            await set(userStatusDatabaseRef, isOnlineForDatabase);
            const isOnlineForFirestore: OnlinePlayer = { uid, name, level, avatarUrl, status: 'idle' };
            await setDoc(userStatusFirestoreRef, isOnlineForFirestore);
            console.log("Presence system: User status set to 'idle'.");
        });
    });
};


export const goOffline = async (uid: string) => {
    const userStatusFirestoreRef = doc(db, 'onlineUsers', uid);
    try {
        await deleteDoc(userStatusFirestoreRef);
    } catch(e) { console.error("Error deleting online user doc:", e); }

    const userStatusDatabaseRef = ref(rtdb, `/status/${uid}`);
    await set(userStatusDatabaseRef, {
        state: 'offline',
        last_changed: rtdbServerTimestamp(),
    });
};


// --- Lobby & Matchmaking ---
export const getOnlinePlayers = (callback: (players: OnlinePlayer[]) => void): (() => void) => {
    const q = query(collection(db, "onlineUsers"));
    return onSnapshot(q, async (snapshot) => {
        const playersFromFirestore = snapshot.docs.map(doc => doc.data() as OnlinePlayer);

        const rtdbStatusRef = ref(rtdb, 'status');
        const rtdbSnapshot = await get(rtdbStatusRef);
        
        if (!rtdbSnapshot.exists()) {
            console.warn("Could not fetch RTDB user statuses for liveness check. Displaying all users from Firestore. Some may be stale.");
            callback(playersFromFirestore);
            return;
        }

        const rtdbStatuses = rtdbSnapshot.val() || {};
        
        const activePlayers = playersFromFirestore.filter(player => {
            const rtdbStatus = rtdbStatuses[player.uid];
            return rtdbStatus && rtdbStatus.state === 'online';
        });

        callback(activePlayers);
    });
};

export const getOnlineUser = async (uid: string): Promise<OnlinePlayer | null> => {
    const docRef = doc(db, 'onlineUsers', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as OnlinePlayer : null;
};

export const joinMatchmakingQueue = async (user: User): Promise<string | null> => {
    const q = query(collection(db, "matchmakingQueue"), where("uid", "!=", user.uid), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        await setDoc(doc(db, "matchmakingQueue", user.uid), { uid: user.uid, joinedAt: serverTimestamp() });
        await updateDoc(doc(db, "onlineUsers", user.uid), { status: 'in_queue' });
        return null;
    } else {
        const opponentDoc = querySnapshot.docs[0];
        const opponentUid = opponentDoc.id;
        const gameId = await createOnlineGame(user.uid, opponentUid);
        const batch = writeBatch(db);
        batch.delete(doc(db, "matchmakingQueue", opponentUid));
        batch.update(doc(db, "onlineUsers", user.uid), { status: 'in_game', gameId });
        batch.update(doc(db, "onlineUsers", opponentUid), { status: 'in_game', gameId });
        await batch.commit();
        return gameId;
    }
};

export const cancelMatchmaking = async (uid: string) => {
    await deleteDoc(doc(db, "matchmakingQueue", uid));
    await updateDoc(doc(db, "onlineUsers", uid), { status: 'idle' });
};

// --- Invitations ---
export const sendInvitation = async (fromUser: User, toUid: string) => {
    const invitationRef = doc(db, 'invitations', toUid);
    await setDoc(invitationRef, {
        from: fromUser.uid,
        fromName: fromUser.displayName || 'Player',
        timestamp: Date.now(),
    });
};

export const listenForInvitations = (uid: string, callback: (invitation: Invitation | null) => void): (() => void) => {
    return onSnapshot(doc(db, 'invitations', uid), (doc) => {
        callback(doc.exists() ? doc.data() as Invitation : null);
    });
};

export const acceptInvitation = async (user: User, invitation: Invitation): Promise<string | null> => {
    const gameId = await createOnlineGame(user.uid, invitation.from);
    const batch = writeBatch(db);
    batch.update(doc(db, "onlineUsers", user.uid), { status: 'in_game', gameId });
    batch.update(doc(db, "onlineUsers", invitation.from), { status: 'in_game', gameId });
    batch.delete(doc(db, "invitations", user.uid));
    await batch.commit();
    return gameId;
};

export const declineInvitation = async (uid: string) => {
    await deleteDoc(doc(db, "invitations", uid));
};

// --- Game Logic ---
export const createOnlineGame = async (player1Uid: string, player2Uid: string): Promise<string> => {
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const gameRef = doc(db, 'games', gameId);

    const [p1Profile, p2Profile] = await Promise.all([
        getUserProfile(player1Uid),
        getUserProfile(player2Uid)
    ]);

    const gameData: OnlineGame = {
        id: gameId,
        players: { X: player1Uid, O: player2Uid },
        playerDetails: {
            [player1Uid]: { 
                name: p1Profile?.name || 'Player 1', 
                avatarUrl: (p1Profile?.activeAvatarId ? ALL_COSMETICS.find(c => c.id === p1Profile.activeAvatarId)?.item as Avatar : DEFAULT_AVATAR).url, 
                level: p1Profile?.level || 1,
                pieceId: p1Profile?.activePieceId || DEFAULT_PIECES_X.id,
                cp: p1Profile?.cp || 0,
            },
            [player2Uid]: { 
                name: p2Profile?.name || 'Player 2', 
                avatarUrl: (p2Profile?.activeAvatarId ? ALL_COSMETICS.find(c => c.id === p2Profile.activeAvatarId)?.item as Avatar : DEFAULT_AVATAR).url, 
                level: p2Profile?.level || 1,
                pieceId: p2Profile?.activePieceId || DEFAULT_PIECES_X.id,
                cp: p2Profile?.cp || 0,
            },
        },
        board: {},
        currentPlayer: 'X',
        status: 'in_progress',
        winner: null,
        winningLine: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        playerTimes: { X: INITIAL_GAME_TIME, O: INITIAL_GAME_TIME },
        turnStartedAt: Date.now(),
    };
    await setDoc(gameRef, gameData);
    return gameId;
};

export const sendOnlineEmote = async (gameId: string, uid: string, emoji: string) => {
    const gameRef = doc(db, 'games', gameId);
    try {
        await updateDoc(gameRef, {
            emotes: { uid, emoji, timestamp: Date.now() }
        });
    } catch (error) { console.error("Failed to send emote:", error); }
};

export const getOnlineGame = async (gameId: string): Promise<OnlineGame | null> => {
    const docRef = doc(db, 'games', gameId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as OnlineGame : null;
};

export const listenForGameStart = (uid: string, callback: (playerData: OnlinePlayer | null) => void): (() => void) => {
    return onSnapshot(doc(db, 'onlineUsers', uid), (doc) => {
        callback(doc.exists() ? doc.data() as OnlinePlayer : null);
    });
};

export const getOnlineGameStream = (gameId: string, callback: (game: OnlineGame | null) => void): (() => void) => {
    return onSnapshot(doc(db, 'games', gameId), (docSnap) => {
        callback(docSnap.exists() ? docSnap.data() as OnlineGame : null);
    });
};

export const makeOnlineMove = async (gameId: string, row: number, col: number, player: Player) => {
    const gameRef = doc(db, 'games', gameId);
    const gameSnap = await getDoc(gameRef);
    if (!gameSnap.exists()) return;

    const gameData = gameSnap.data() as OnlineGame;
    if (gameData.status !== 'in_progress' || gameData.currentPlayer !== player) return;

    const newBoard = mapToBoard(gameData.board);
    if (newBoard[row][col] !== null) return;
    newBoard[row][col] = player;

    const timeElapsed = Math.round((Date.now() - gameData.turnStartedAt) / 1000);
    const newPlayerTimes = { ...gameData.playerTimes };
    newPlayerTimes[player] = Math.max(0, newPlayerTimes[player] - timeElapsed);

    if (newPlayerTimes[player] === 0) {
        await updateDoc(gameRef, {
            playerTimes: newPlayerTimes,
            status: 'finished',
            winner: player === 'X' ? 'O' : 'X',
        });
        return;
    }

    const winningLine = checkWin(newBoard, player);
    const isDraw = newBoard.every(r => r.every(c => c !== null)) && !winningLine;

    const update: Partial<OnlineGame> = {
        board: boardToMap(newBoard),
        currentPlayer: player === 'X' ? 'O' : 'X',
        updatedAt: Date.now(),
        status: (winningLine || isDraw) ? 'finished' : 'in_progress',
        winner: winningLine ? player : isDraw ? 'draw' : null,
        winningLine: winningLine || null,
        playerTimes: newPlayerTimes,
        turnStartedAt: Date.now(),
    };

    await updateDoc(gameRef, update);
};

export const claimTimeoutVictory = async (gameId: string, claimant: Player) => {
    const gameRef = doc(db, 'games', gameId);
    try {
        const gameSnap = await getDoc(gameRef);
        if (!gameSnap.exists()) return;

        const gameData = gameSnap.data() as OnlineGame;
        if (gameData.status === 'in_progress' && gameData.currentPlayer !== claimant) {
            const timeSinceLastMove = (Date.now() - gameData.turnStartedAt) / 1000;
            if (timeSinceLastMove > (TURN_TIME + 2)) {
                console.log(`Player ${claimant} is claiming a timeout victory.`);
                await updateDoc(gameRef, {
                    status: 'finished',
                    winner: claimant,
                });
            }
        }
    } catch (e) { console.error("Error claiming timeout victory:", e); }
};

export const updatePlayerPieceSkin = async (gameId: string, uid: string, pieceId: string) => {
    const gameRef = doc(db, 'games', gameId);
    try {
        await updateDoc(gameRef, { [`playerDetails.${uid}.pieceId`]: pieceId });
    } catch (error) {
        console.log("Could not update piece skin (game may be over):", error);
    }
};

export const resignOnlineGame = async (gameId: string, resigningPlayer: Player) => {
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
        status: 'finished',
        winner: resigningPlayer === 'X' ? 'O' : 'X',
    });
};

export const returnToLobby = async (uid: string) => {
    const userStatusRef = doc(db, 'onlineUsers', uid);
    try {
        const docSnap = await getDoc(userStatusRef);
        if (docSnap.exists()) {
            await updateDoc(userStatusRef, { status: 'idle', gameId: null });
        }
    } catch (e) {
        console.error("Failed to return user to lobby:", e);
    }
};

export const leaveOnlineGame = async (gameId: string, uid: string) => {
    await returnToLobby(uid);
};

export const cleanupOldGames = async (): Promise<void> => {
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    
    const finishedGamesQuery = query(
        collection(db, 'games'), 
        where('status', '==', 'finished'),
        where('updatedAt', '<', thirtyMinutesAgo)
    );

    const inactiveGamesQuery = query(
        collection(db, 'games'),
        where('status', '==', 'in_progress'),
        where('updatedAt', '<', thirtyMinutesAgo)
    );

    try {
        const [finishedGamesSnapshot, inactiveGamesSnapshot] = await Promise.all([
            getDocs(finishedGamesQuery),
            getDocs(inactiveGamesQuery)
        ]);

        if (finishedGamesSnapshot.empty && inactiveGamesSnapshot.empty) {
            return;
        }
        
        const batch = writeBatch(db);
        let count = 0;

        finishedGamesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
            count++;
        });

        inactiveGamesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
            count++;
        });

        if (count > 0) {
            await batch.commit();
            console.log(`Cleaned up ${count} old/inactive games.`);
        }

    } catch (error) {
        console.error("Error cleaning up old games:", error);
    }
};