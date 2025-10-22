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
  where,
} from 'firebase/firestore';
import {
  ref,
  onValue,
  set,
  onDisconnect,
  serverTimestamp as rtdbServerTimestamp,
  get,
} from 'firebase/database';
import { User, updateProfile } from 'firebase/auth';
import type {
  UserProfile,
  OnlinePlayer,
  BoardState,
  Player,
  Invitation,
  OnlineGame,
  BoardMap,
  Avatar,
  Emoji,
} from '../types';
import {
  DEFAULT_THEME,
  DEFAULT_PIECES_X,
  DEFAULT_AVATAR,
  DEFAULT_EFFECT,
  DEFAULT_VICTORY_EFFECT,
  DEFAULT_BOOM_EFFECT,
  ALL_COSMETICS,
  BOARD_SIZE,
  WINNING_LENGTH,
  EMOJIS,
} from '../constants';

const DEFAULT_EMOJI_IDS = ALL_COSMETICS.filter(
  (c) => c.type === 'emoji' && c.price === 0
).map((c) => c.id);

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
  const board: BoardState = Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null));
  for (const key in map) {
    const [r, c] = key.split('_').map(Number);
    board[r][c] = map[key];
  }
  return board;
};

export const getLastMove = (
  oldBoard: BoardState,
  newBoard: BoardState
): { row: number; col: number } | null => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (oldBoard[r][c] === null && newBoard[r][c] !== null) {
        return { row: r, col: c };
      }
    }
  }
  return null;
};

const checkWin = (
  board: BoardState,
  player: Player
): { row: number; col: number }[] | null => {
  const directions = [
    { r: 0, c: 1 },
    { r: 1, c: 0 },
    { r: 1, c: 1 },
    { r: 1, c: -1 },
  ];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === player) {
        for (const dir of directions) {
          const line = [];
          for (let i = 0; i < WINNING_LENGTH; i++) {
            const newR = r + i * dir.r;
            const newC = c + i * dir.c;
            if (
              newR >= 0 &&
              newR < BOARD_SIZE &&
              newC >= 0 &&
              newC < BOARD_SIZE &&
              board[newR][newC] === player
            ) {
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

export const getOwnedEmojis = (
  ownedIds: string[],
  inventory: Record<string, number>
): Emoji[] => {
  const ownedEmojiIds = new Set(
    ownedIds.filter((id) => id.startsWith('emoji_'))
  );
  for (const emojiId in inventory) {
    if (inventory[emojiId] > 0) {
      ownedEmojiIds.add(emojiId);
    }
  }
  return EMOJIS.filter((emoji) => ownedEmojiIds.has(emoji.id));
};

export const getRandomEmoji = (): Emoji => {
  // Select from a subset of non-negative emojis to avoid AI being toxic
  const safeEmojis = EMOJIS.filter(
    (e) => !['😠', '😭', '💀', '🤡'].includes(e.emoji)
  );
  return safeEmojis[Math.floor(Math.random() * safeEmojis.length)];
};

// --- User Profile Management ---
export const createUserProfile = async (
  user: User,
  name: string
): Promise<void> => {
  const userRef = doc(db, 'users', user.uid);
  const userProfile: UserProfile = {
    uid: user.uid,
    name,
    email: user.email,
    isAnonymous: user.isAnonymous,
    level: 1,
    xp: 0,
    coins: 500,
    onlineWins: 0,
    onlineLosses: 0,
    onlineDraws: 0,
    pveWins: 0,
    pveLosses: 0,
    pveDraws: 0,
    ownedCosmeticIds: [
      DEFAULT_THEME.id,
      DEFAULT_PIECES_X.id,
      DEFAULT_AVATAR.id,
      DEFAULT_EFFECT.id,
      DEFAULT_VICTORY_EFFECT.id,
      DEFAULT_BOOM_EFFECT.id,
      ...DEFAULT_EMOJI_IDS,
    ],
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

export const getUserProfile = async (
  uid: string
): Promise<UserProfile | null> => {
  const userRef = doc(db, 'users', uid);
  const docSnap = await getDoc(userRef);
  return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
};

export const updateUserProfile = async (
  uid: string,
  data: Partial<UserProfile>
): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  // Use setDoc with merge to prevent "No document to update" error on new user creation
  await setDoc(userRef, data, { merge: true });
};

export const updateAuthAndProfileName = async (user: User, name: string) => {
  await updateProfile(user, { displayName: name });
  await updateUserProfile(user.uid, { name });

  // Also update the presence document if it exists
  const onlineUserRef = doc(db, 'onlineUsers', user.uid);
  try {
    const onlineUserSnap = await getDoc(onlineUserRef);
    if (onlineUserSnap.exists()) {
      await updateDoc(onlineUserRef, { name });
    }
  } catch (e) {
    console.warn(
      'Could not update online user name, document may not exist yet.'
    );
  }
};

// --- Presence System ---
export const setupPresenceSystem = (
  user: User,
  level: number,
  avatarUrl: string,
  name: string
) => {
  const uid = user.uid;
  const userStatusDatabaseRef = ref(rtdb, `/status/${uid}`);
  const userStatusFirestoreRef = doc(db, 'onlineUsers', uid);

  const isOnlineForFirestore: OnlinePlayer = {
    uid,
    name,
    level,
    avatarUrl,
    status: 'idle',
  };
  const isOnlineForDatabase = {
    state: 'online',
    last_changed: rtdbServerTimestamp(),
  };
  const isOfflineForDatabase = {
    state: 'offline',
    last_changed: rtdbServerTimestamp(),
  };

  onValue(ref(rtdb, '.info/connected'), (snapshot) => {
    if (snapshot.val() === false) {
      // Firestore deletion must be handled by a cleanup function
      // since onDisconnect cannot write to Firestore.
      return;
    }

    onDisconnect(userStatusDatabaseRef)
      .set(isOfflineForDatabase)
      .then(() => {
        set(userStatusDatabaseRef, isOnlineForDatabase);
        setDoc(userStatusFirestoreRef, isOnlineForFirestore);
      });
  });
};

export const goOffline = async (uid: string) => {
  const userStatusFirestoreRef = doc(db, 'onlineUsers', uid);
  await deleteDoc(userStatusFirestoreRef);
  const userStatusDatabaseRef = ref(rtdb, `/status/${uid}`);
  await set(userStatusDatabaseRef, {
    state: 'offline',
    last_changed: rtdbServerTimestamp(),
  });
};

// --- Lobby & Matchmaking ---
export const getOnlinePlayers = (
  callback: (players: OnlinePlayer[]) => void
): (() => void) => {
  const q = query(collection(db, 'onlineUsers'));
  return onSnapshot(q, (snapshot) => {
    const players = snapshot.docs.map((doc) => doc.data() as OnlinePlayer);
    callback(players);
  });
};

export const getOnlineUser = async (
  uid: string
): Promise<OnlinePlayer | null> => {
  const docRef = doc(db, 'onlineUsers', uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (docSnap.data() as OnlinePlayer) : null;
};

export const cleanupGhostPlayers = async () => {
  console.log('Running periodic cleanup...');
  const q = query(collection(db, 'onlineUsers'));
  const snapshot = await getDocs(q);
  const playersInLobby = snapshot.docs.map((d) => d.data() as OnlinePlayer);

  const promises = playersInLobby.map((player) => {
    const statusRef = ref(rtdb, `/status/${player.uid}/state`);
    return get(statusRef)
      .then((snapshot) => {
        if (!snapshot.exists() || snapshot.val() === 'offline') {
          console.log(`Cleaning up ghost player from lobby: ${player.name}`);
          return deleteDoc(doc(db, 'onlineUsers', player.uid));
        }
        return Promise.resolve();
      })
      .catch((err) => console.error('Error checking ghost status:', err));
  });
  await Promise.all(promises);
};

export const triggerCleanup = async () => {
  try {
    await cleanupGhostPlayers();
  } catch (error) {
    console.error('Error during triggered cleanup:', error);
  }
};

export const joinMatchmakingQueue = async (
  user: User
): Promise<string | null> => {
  // Find an opponent who is not the current user
  const q = query(
    collection(db, 'matchmakingQueue'),
    where('uid', '!=', user.uid),
    limit(1)
  );
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    // Queue is empty, add the current user to it and wait.
    await setDoc(doc(db, 'matchmakingQueue', user.uid), {
      uid: user.uid,
      joinedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'onlineUsers', user.uid), { status: 'in_queue' });
    return null; // The user is now waiting for an opponent.
  } else {
    // Found an opponent.
    const opponentDoc = querySnapshot.docs[0];
    const opponentUid = opponentDoc.id;

    // Immediately create the game.
    const gameId = await createOnlineGame(user.uid, opponentUid);

    // Use a batch write to atomically update statuses and remove from queue.
    const batch = writeBatch(db);

    // Remove the opponent from the queue.
    batch.delete(doc(db, 'matchmakingQueue', opponentUid));
    // Update this user's status to 'in_game'.
    batch.update(doc(db, 'onlineUsers', user.uid), {
      status: 'in_game',
      gameId,
    });
    // Update the opponent's status to 'in_game'.
    batch.update(doc(db, 'onlineUsers', opponentUid), {
      status: 'in_game',
      gameId,
    });

    await batch.commit();

    return gameId; // Return the gameId so the client can navigate immediately.
  }
};

export const cancelMatchmaking = async (uid: string) => {
  // Remove user from matchmaking queue
  await deleteDoc(doc(db, 'matchmakingQueue', uid));
  // Reset user status to idle
  await updateDoc(doc(db, 'onlineUsers', uid), { status: 'idle' });
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

export const listenForInvitations = (
  uid: string,
  callback: (invitation: Invitation | null) => void
): (() => void) => {
  return onSnapshot(doc(db, 'invitations', uid), (doc) => {
    callback(doc.exists() ? (doc.data() as Invitation) : null);
  });
};

export const acceptInvitation = async (
  user: User,
  invitation: Invitation
): Promise<string | null> => {
  const gameId = await createOnlineGame(invitation.from, user.uid);
  const batch = writeBatch(db);
  batch.update(doc(db, 'onlineUsers', user.uid), { status: 'in_game', gameId });
  batch.update(doc(db, 'onlineUsers', invitation.from), {
    status: 'in_game',
    gameId,
  });
  batch.delete(doc(db, 'invitations', user.uid));
  await batch.commit();
  return gameId;
};

export const declineInvitation = async (uid: string) => {
  await deleteDoc(doc(db, 'invitations', uid));
};

// --- Game Logic ---
export const createOnlineGame = async (
  player1Uid: string,
  player2Uid: string
): Promise<string> => {
  const gameId = `game_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 7)}`;
  const gameRef = doc(db, 'games', gameId);

  const [p1Profile, p2Profile] = await Promise.all([
    getUserProfile(player1Uid),
    getUserProfile(player2Uid),
  ]);

  const gameData: OnlineGame = {
    id: gameId,
    players: { X: player1Uid, O: player2Uid },
    playerDetails: {
      [player1Uid]: {
        name: p1Profile?.name || 'Player 1',
        avatarUrl: (p1Profile?.activeAvatarId
          ? (ALL_COSMETICS.find((c) => c.id === p1Profile.activeAvatarId)
              ?.item as Avatar)
          : DEFAULT_AVATAR
        ).url,
        level: p1Profile?.level || 1,
        pieceId: p1Profile?.activePieceId || DEFAULT_PIECES_X.id,
      },
      [player2Uid]: {
        name: p2Profile?.name || 'Player 2',
        avatarUrl: (p2Profile?.activeAvatarId
          ? (ALL_COSMETICS.find((c) => c.id === p2Profile.activeAvatarId)
              ?.item as Avatar)
          : DEFAULT_AVATAR
        ).url,
        level: p2Profile?.level || 1,
        pieceId: p2Profile?.activePieceId || DEFAULT_PIECES_X.id,
      },
    },
    board: {},
    currentPlayer: 'X',
    status: 'in_progress',
    winner: null,
    winningLine: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rematch: {},
    leftGame: {},
  };
  await setDoc(gameRef, gameData);
  return gameId;
};

export const sendOnlineEmote = async (
  gameId: string,
  uid: string,
  emoji: string
) => {
  const gameRef = doc(db, 'games', gameId);
  try {
    await updateDoc(gameRef, {
      emotes: {
        uid,
        emoji,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error('Failed to send emote:', error);
  }
};

export const getOnlineGame = async (
  gameId: string
): Promise<OnlineGame | null> => {
  const docRef = doc(db, 'games', gameId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (docSnap.data() as OnlineGame) : null;
};

export const listenForGameStart = (
  uid: string,
  callback: (gameId: string | null) => void
): (() => void) => {
  return onSnapshot(doc(db, 'onlineUsers', uid), (doc) => {
    if (doc.exists()) {
      const data = doc.data() as OnlinePlayer;
      callback(data.gameId || null);
    }
  });
};

export const getOnlineGameStream = (
  gameId: string,
  callback: (game: OnlineGame | null) => void
): (() => void) => {
  return onSnapshot(doc(db, 'games', gameId), (docSnap) => {
    callback(docSnap.exists() ? (docSnap.data() as OnlineGame) : null);
  });
};

export const makeOnlineMove = async (
  gameId: string,
  row: number,
  col: number,
  player: Player
) => {
  const gameRef = doc(db, 'games', gameId);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) return;

  const gameData = gameSnap.data() as OnlineGame;
  if (gameData.status !== 'in_progress' || gameData.currentPlayer !== player)
    return;

  const newBoard = mapToBoard(gameData.board);
  newBoard[row][col] = player;

  const winningLine = checkWin(newBoard, player);
  const isDraw =
    newBoard.every((r) => r.every((c) => c !== null)) && !winningLine;

  const update: Partial<OnlineGame> = {
    board: boardToMap(newBoard),
    currentPlayer: player === 'X' ? 'O' : 'X',
    updatedAt: Date.now(),
    status: winningLine || isDraw ? 'finished' : 'in_progress',
    winner: winningLine ? player : isDraw ? 'draw' : null,
    winningLine: winningLine || null,
  };

  await updateDoc(gameRef, update);
};

export const updatePlayerPieceSkin = async (
  gameId: string,
  uid: string,
  pieceId: string
) => {
  const gameRef = doc(db, 'games', gameId);
  try {
    await updateDoc(gameRef, {
      [`playerDetails.${uid}.pieceId`]: pieceId,
    });
  } catch (error) {
    // Game might have been deleted after it ended, this is not a critical error.
    console.log('Could not update piece skin (game may be over):', error);
  }
};

export const resignOnlineGame = async (
  gameId: string,
  resigningPlayer: Player
) => {
  const gameRef = doc(db, 'games', gameId);
  await updateDoc(gameRef, {
    status: 'finished',
    winner: resigningPlayer === 'X' ? 'O' : 'X',
  });
};

export const returnToLobby = async (uid: string) => {
  const userStatusRef = doc(db, 'onlineUsers', uid);
  const docSnap = await getDoc(userStatusRef);
  if (docSnap.exists()) {
    await updateDoc(userStatusRef, {
      status: 'idle',
      gameId: null,
    });
  }
};

export const leaveOnlineGame = async (gameId: string, uid: string) => {
  const gameRef = doc(db, 'games', gameId);
  const gameSnap = await getDoc(gameRef);

  if (gameSnap.exists()) {
    const gameData = gameSnap.data() as OnlineGame;
    const opponentUid =
      gameData.players.X === uid ? gameData.players.O : gameData.players.X;

    if (gameData.leftGame?.[opponentUid]) {
      // Opponent has already left, so this player is the last one out.
      // Delete the game document.
      await deleteDoc(gameRef);
      console.log(`Game room ${gameId} cleaned up by last player.`);
    } else {
      // Opponent hasn't left yet, so just mark this player as having left.
      await updateDoc(gameRef, {
        [`leftGame.${uid}`]: true,
      });
    }
  }

  // In either case, return the player to the lobby.
  await returnToLobby(uid);
};

export const requestRematch = async (gameId: string, uid: string) => {
  const gameRef = doc(db, 'games', gameId);
  await updateDoc(gameRef, {
    [`rematch.${uid}`]: 'requested',
  });
};

export const acceptRematch = async (
  gameId: string,
  acceptingUid: string,
  opponentUid: string
): Promise<string | null> => {
  const newGameId = await createOnlineGame(opponentUid, acceptingUid); // Swap players for the new game
  const batch = writeBatch(db);

  // Update both players to be in the new game
  batch.update(doc(db, 'onlineUsers', acceptingUid), {
    status: 'in_game',
    gameId: newGameId,
  });
  batch.update(doc(db, 'onlineUsers', opponentUid), {
    status: 'in_game',
    gameId: newGameId,
  });

  // Update the OLD game document to notify clients of the new game
  batch.update(doc(db, 'games', gameId), {
    [`rematch.${acceptingUid}`]: 'accepted',
    nextGameId: newGameId,
  });

  await batch.commit();
  return newGameId;
};
