/**
 * Manages the AI's "Opening Book".
 * The book stores sequences of early-game moves that have led to a win for the AI.
 * This allows the AI to play strong, proven opening moves instantly without
 * needing to run the expensive Minimax calculation.
 */
import type { BoardState } from '../types';

// The key used to store the opening book in localStorage.
const OPENING_BOOK_KEY = 'caroOpeningBook_v1';
// We'll only record the first 8 moves of a winning game.
const MAX_OPENING_MOVES = 8;

export type OpeningBook = Map<string, { row: number; col: number }>;

// Helper to convert a board state into a unique string key.
const boardToKey = (board: BoardState): string => {
    return board.map(row => row.map(cell => cell || '-').join('')).join('');
};

/**
 * Loads the opening book from localStorage.
 * Handles JSON parsing and converting the stored object back into a Map.
 */
export const loadOpeningBook = (): OpeningBook => {
    try {
        const savedBook = localStorage.getItem(OPENING_BOOK_KEY);
        if (savedBook) {
            // JSON.parse can't natively handle Maps, so we revive it from an array of [key, value] pairs.
            return new Map(JSON.parse(savedBook));
        }
    } catch (error) {
        console.error("Failed to load or parse opening book from localStorage", error);
        localStorage.removeItem(OPENING_BOOK_KEY);
    }
    return new Map();
};

/**
 * Saves the opening book to localStorage.
 * Converts the Map into an array of [key, value] pairs for JSON compatibility.
 */
const saveOpeningBook = (book: OpeningBook) => {
    try {
        // JSON.stringify can't handle Maps, so convert to an array first.
        const arrayToStore = Array.from(book.entries());
        localStorage.setItem(OPENING_BOOK_KEY, JSON.stringify(arrayToStore));
    } catch (error) {
        console.error("Failed to save opening book to localStorage", error);
    }
};

/**
 * Updates the opening book with moves from a game the AI just won.
 * @param moveHistory - An array of moves [{row, col}, ...] from the completed game.
 */
export const updateOpeningBook = (moveHistory: { row: number, col: number }[]) => {
    if (!moveHistory || moveHistory.length === 0) return;

    const book = loadOpeningBook();
    const board: BoardState = Array(15).fill(null).map(() => Array(15).fill(null));
    let currentPlayer: 'X' | 'O' = 'X'; // Assuming X always starts

    // Iterate through the first few moves of the game.
    for (let i = 0; i < moveHistory.length - 1 && i < MAX_OPENING_MOVES; i++) {
        const move = moveHistory[i];
        const nextMove = moveHistory[i + 1];

        // Generate the key for the board state *before* the next move.
        const key = boardToKey(board);

        // Update the current player's piece on the board.
        if(board[move.row][move.col] === null) {
            board[move.row][move.col] = currentPlayer;
        }

        // We only want the AI to learn its own successful moves.
        // Let's assume AI is 'O'. We record the state before 'O's turn and the move 'O' made.
        // If the AI is player 'O', its moves are at indices 1, 3, 5, ...
        if (i % 2 !== 0) { // This is an AI ('O') move
             // The key is the state of the board *before* the AI's move.
             // The value is the move the AI made.
            book.set(key, nextMove);
        }
        
        // Switch player for the next loop iteration.
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    }

    saveOpeningBook(book);
    console.log(`Opening book updated. Current size: ${book.size}`);
};


/**
 * Tries to find a move for the current board state from the opening book.
 * @param board The current board state.
 * @param book The loaded opening book.
 * @returns A move {row, col} if found, otherwise null.
 */
export const getMoveFromBook = (board: BoardState, book: OpeningBook): { row: number; col: number } | null => {
    const key = boardToKey(board);
    const move = book.get(key);
    if (move && board[move.row][move.col] === null) {
        console.log("AI Move: Found in opening book.", move);
        return move;
    }
    return null;
};
