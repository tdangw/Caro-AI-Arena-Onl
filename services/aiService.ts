
import type { BoardState, Player, CellState } from '../types';
import { BOARD_SIZE, WINNING_LENGTH } from '../constants';
import { loadOpeningBook, getMoveFromBook, type OpeningBook } from './openingBook';

const checkWin = (board: BoardState, player: Player): boolean => {
    const directions = [ { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: -1 } ];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === player) {
                for (const dir of directions) {
                    let count = 1;
                    for (let i = 1; i < WINNING_LENGTH; i++) {
                        const newR = r + i * dir.r;
                        const newC = c + i * dir.c;
                        if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && board[newR][newC] === player) {
                            count++;
                        } else {
                            break;
                        }
                    }
                    if (count === WINNING_LENGTH) return true;
                }
            }
        }
    }
    return false;
};

// --- Minimax & Advanced Evaluation AI Logic ---

const getValidMoves = (board: BoardState): { row: number; col: number }[] => {
    const moves = new Set<string>();
    let hasPieces = false;
    const center = Math.floor(BOARD_SIZE / 2);

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== null) {
                hasPieces = true;
                // Check a 3x3 radius around each piece for potential moves
                for (let i = -2; i <= 2; i++) {
                    for (let j = -2; j <= 2; j++) {
                        if (i === 0 && j === 0) continue;
                        const newR = r + i;
                        const newC = c + j;
                        if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && board[newR][newC] === null) {
                            moves.add(`${newR},${newC}`);
                        }
                    }
                }
            }
        }
    }
    // If board is empty, only suggest center moves
    if (!hasPieces) {
        return [{ row: center, col: center }];
    }
    // If no moves found near existing pieces (highly unlikely), return all empty cells
    if (moves.size === 0) {
        const allEmptyMoves: {row: number, col: number}[] = [];
         for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === null) allEmptyMoves.push({row: r, col: c});
            }
         }
         return allEmptyMoves;
    }

    return Array.from(moves).map(m => {
        const [row, col] = m.split(',').map(Number);
        return { row, col };
    });
};

const PATTERN_SCORES = {
    FIVE: 10000000,
    LIVE_FOUR: 500000,
    DEAD_FOUR: 400000,
    LIVE_THREE: 50000,
    DEAD_THREE: 10000,
    LIVE_TWO: 700,
    DEAD_TWO: 100,
    LIVE_ONE: 10,
    DEAD_ONE: 1,
};

const evaluateWindowAdvanced = (window: CellState[], player: Player) => {
    const opponent = player === 'X' ? 'O' : 'X';
    const playerCount = window.filter(p => p === player).length;
    const opponentCount = window.filter(p => p === opponent).length;
    
    if (playerCount > 0 && opponentCount > 0) return 0; // Mixed window is neutral

    const count = playerCount || opponentCount;
    const piecesOwner = playerCount > 0 ? player : opponent;

    // Check for open ends
    const first = window[0];
    const last = window[window.length - 1];
    let openEnds = 0;
    if (first === null) openEnds++;
    if (last === null) openEnds++;

    let windowScore = 0;

    if (count === 5) {
        windowScore = PATTERN_SCORES.FIVE;
    } else if (count === 4) {
        windowScore = openEnds === 2 ? PATTERN_SCORES.LIVE_FOUR : openEnds === 1 ? PATTERN_SCORES.DEAD_FOUR : 0;
    } else if (count === 3) {
        windowScore = openEnds === 2 ? PATTERN_SCORES.LIVE_THREE : openEnds === 1 ? PATTERN_SCORES.DEAD_THREE : 0;
    } else if (count === 2) {
        windowScore = openEnds === 2 ? PATTERN_SCORES.LIVE_TWO : openEnds === 1 ? PATTERN_SCORES.DEAD_TWO : 0;
    } else if (count === 1) {
        windowScore = openEnds === 2 ? PATTERN_SCORES.LIVE_ONE : openEnds === 1 ? PATTERN_SCORES.DEAD_ONE : 0;
    }

    return piecesOwner === player ? windowScore : -windowScore;
};

const scorePositionAdvanced = (board: BoardState, player: Player) => {
    let score = 0;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            // Add a small positional bonus for being near the center
            if (board[r][c] === player) {
                 score += 7 - (Math.abs(r - 7) + Math.abs(c - 7)) / 2;
            } else if (board[r][c] !== null) {
                 score -= 7 - (Math.abs(r - 7) + Math.abs(c - 7)) / 2;
            }

            // Heuristic for horizontal patterns of 5
            if (c <= BOARD_SIZE - WINNING_LENGTH) {
                const window5: CellState[] = [];
                for(let i=0; i<WINNING_LENGTH; i++) window5.push(board[r][c+i]);
                score += evaluateWindowAdvanced(window5, player);
            }
            // Heuristic for vertical patterns of 5
            if (r <= BOARD_SIZE - WINNING_LENGTH) {
                const window5: CellState[] = [];
                for(let i=0; i<WINNING_LENGTH; i++) window5.push(board[r+i][c]);
                score += evaluateWindowAdvanced(window5, player);
            }
            // Heuristic for diagonal (down-right) patterns of 5
            if (r <= BOARD_SIZE - WINNING_LENGTH && c <= BOARD_SIZE - WINNING_LENGTH) {
                const window5: CellState[] = [];
                for(let i=0; i<WINNING_LENGTH; i++) window5.push(board[r+i][c+i]);
                score += evaluateWindowAdvanced(window5, player);
            }
            // Heuristic for anti-diagonal (up-right) patterns of 5
            if (r >= WINNING_LENGTH - 1 && c <= BOARD_SIZE - WINNING_LENGTH) {
                const window5: CellState[] = [];
                for(let i=0; i<WINNING_LENGTH; i++) window5.push(board[r-i][c+i]);
                score += evaluateWindowAdvanced(window5, player);
            }
        }
    }
    return score;
}

/**
 * Analyzes the board for the best immediate offensive and defensive moves.
 * @returns An object containing the best potential move for the AI and the best potential move for the opponent.
 */
const analyzeThreats = (board: BoardState, player: Player, scoreFunction: (b: BoardState, p: Player) => number) => {
    const opponent = player === 'X' ? 'O' : 'X';
    const emptyCells = getValidMoves(board);

    let bestOpponentMove: { move: { row: number; col: number }; score: number } | null = null;
    let maxOpponentScore = -Infinity;

    let bestAiMove: { move: { row: number; col: number }; score: number } | null = null;
    let maxAiScore = -Infinity;

    for (const move of emptyCells) {
        // Check opponent's threat potential from this move
        const opponentBoard = board.map(r => [...r]);
        opponentBoard[move.row][move.col] = opponent;
        const opponentScore = scoreFunction(opponentBoard, opponent); // Score from opponent's perspective

        if (opponentScore > maxOpponentScore) {
            maxOpponentScore = opponentScore;
            bestOpponentMove = { move, score: opponentScore };
        }

        // Check AI's own opportunity from this move
        const aiBoard = board.map(r => [...r]);
        aiBoard[move.row][move.col] = player;
        const aiScore = scoreFunction(aiBoard, player); // Score from AI's perspective

        if (aiScore > maxAiScore) {
            maxAiScore = aiScore;
            bestAiMove = { move, score: aiScore };
        }
    }

    return { bestOpponentMove, bestAiMove };
}


// Synchronous version for Easy/Medium AI
const minimaxSync = (board: BoardState, depth: number, alpha: number, beta: number, maximizingPlayer: boolean, aiPlayer: Player, scoreFunction: (b: BoardState, p: Player) => number): { score: number; move?: { row: number; col: number } } => {
    if (depth === 0 || checkWin(board, 'X') || checkWin(board, 'O')) {
        return { score: scoreFunction(board, aiPlayer) };
    }

    const possibleMoves = getValidMoves(board);
    if (possibleMoves.length === 0) {
        return { score: scoreFunction(board, aiPlayer) };
    }

    let bestMove = possibleMoves[0];

    if (maximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of possibleMoves) {
            const newBoard = board.map(r => [...r]);
            newBoard[move.row][move.col] = aiPlayer;
            const result = minimaxSync(newBoard, depth - 1, alpha, beta, false, aiPlayer, scoreFunction);
            if (result.score > maxEval) {
                maxEval = result.score;
                bestMove = move;
            }
            alpha = Math.max(alpha, result.score);
            if (beta <= alpha) break;
        }
        return { score: maxEval, move: bestMove };
    } else { // Minimizing player
        let minEval = Infinity;
        const humanPlayer = aiPlayer === 'X' ? 'O' : 'X';
        for (const move of possibleMoves) {
            const newBoard = board.map(r => [...r]);
            newBoard[move.row][move.col] = humanPlayer;
            const result = minimaxSync(newBoard, depth - 1, alpha, beta, true, aiPlayer, scoreFunction);
            if (result.score < minEval) {
                minEval = result.score;
                bestMove = move;
            }
            beta = Math.min(beta, result.score);
            if (beta <= alpha) break;
        }
        return { score: minEval, move: bestMove };
    }
}

const findBestMoveWithMinimax = (board: BoardState, aiPlayer: Player, depth: number, scoreFunction: (b: BoardState, p: Player) => number, skillLevel: 'easy' | 'medium' | 'hard'): { row: number; col: number } => {
    const humanPlayer = aiPlayer === 'X' ? 'O' : 'X';
    const emptyCells = getValidMoves(board);

    // Check for an immediate winning move
    for (const cell of emptyCells) {
        const tempBoard = board.map(r => [...r]);
        tempBoard[cell.row][cell.col] = aiPlayer;
        if (checkWin(tempBoard, aiPlayer)) {
          return cell;
        }
    }

    // Check to block an immediate opponent win
    for (const cell of emptyCells) {
        const tempBoard = board.map(r => [...r]);
        tempBoard[cell.row][cell.col] = humanPlayer;
        if (checkWin(tempBoard, humanPlayer)) {
          return cell;
        }
    }

    // Easy AI special logic: Find and block the opponent's best move, especially lines of 3.
    if (skillLevel === 'easy') {
        const { bestOpponentMove, bestAiMove } = analyzeThreats(board, aiPlayer, scoreFunction);

        // A "Dead Three" is a significant threat that should be blocked.
        if (bestOpponentMove && bestOpponentMove.score >= PATTERN_SCORES.DEAD_THREE) {
            // Block it, unless the AI's own move is significantly better (e.g., creates a bigger threat).
            if (bestAiMove && bestAiMove.score > bestOpponentMove.score * 1.2) {
                 console.log("Easy AI: Found a better offensive move, ignoring block.", bestAiMove.move);
                 return bestAiMove.move;
            }
            console.log("Easy AI: Blocking opponent's 3-in-a-row threat.", bestOpponentMove.move);
            return bestOpponentMove.move;
        }
        
        // If no major threats, make the best move for itself.
        if (bestAiMove) {
            return bestAiMove.move;
        }

        // Fallback, should not be reached if emptyCells exist
        return emptyCells[0];
    }
    
    // --- TACTICAL ANALYSIS FOR MEDIUM/HARD AI ---
    // For stronger AI, check for critical threats before committing to a deep search.
    // This prevents blunders where a short-term gain is prioritized over blocking a long-term threat.
    if (skillLevel === 'medium' || skillLevel === 'hard') {
        const { bestOpponentMove, bestAiMove } = analyzeThreats(board, aiPlayer, scoreFunction);
        
        // A "live three" is a major threat that must be addressed.
        const threatThreshold = PATTERN_SCORES.LIVE_THREE;

        if (bestOpponentMove && bestOpponentMove.score >= threatThreshold) {
            // Block the threat unless the AI has an equal or better counter-move.
            // An example of a better move would be creating its own "live three" that also blocks the opponent,
            // or creating a "live four".
            if (!bestAiMove || bestOpponentMove.score > bestAiMove.score) {
                console.log(`AI (${skillLevel}): Blocking critical player threat.`, bestOpponentMove.move);
                return bestOpponentMove.move;
            }
        }
    }


    // If not easy AI, run minimax
    const { move } = minimaxSync(board, depth, -Infinity, Infinity, true, aiPlayer, scoreFunction);
    
    if (move && board[move.row]?.[move.col] === null) {
        return move;
    }
    
    // Final fallback if minimax fails (should not happen)
    console.error("Minimax failed to return a valid move, picking a random one from available moves.");
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
};


// Asynchronous, non-blocking recursive version for the 'hard' AI to prevent UI freezing
const minimaxAsync = async (board: BoardState, depth: number, alpha: number, beta: number, maximizingPlayer: boolean, aiPlayer: Player, scoreFunction: (b: BoardState, p: Player) => number, nodeCounter: { count: number }, movesToConsider?: { row: number; col: number }[]): Promise<{ score: number; move?: { row: number; col: number } }> => {
    if (depth === 0 || checkWin(board, 'X') || checkWin(board, 'O')) {
        return { score: scoreFunction(board, aiPlayer) };
    }

    const possibleMoves = movesToConsider || getValidMoves(board);
    if (possibleMoves.length === 0) {
        return { score: scoreFunction(board, aiPlayer) };
    }

    let bestMove = possibleMoves[0];

    if (maximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of possibleMoves) {
            nodeCounter.count++;
            if (nodeCounter.count % 25 === 0) { // Yield to event loop every 25 nodes
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            const newBoard = board.map(r => [...r]);
            newBoard[move.row][move.col] = aiPlayer;
            const result = await minimaxAsync(newBoard, depth - 1, alpha, beta, false, aiPlayer, scoreFunction, nodeCounter);
            if (result.score > maxEval) {
                maxEval = result.score;
                bestMove = move;
            }
            alpha = Math.max(alpha, result.score);
            if (beta <= alpha) break;
        }
        return { score: maxEval, move: bestMove };
    } else { // Minimizing player
        let minEval = Infinity;
        const humanPlayer = aiPlayer === 'X' ? 'O' : 'X';
        for (const move of possibleMoves) {
            nodeCounter.count++;
            if (nodeCounter.count % 25 === 0) { // Yield to event loop every 25 nodes
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            const newBoard = board.map(r => [...r]);
            newBoard[move.row][move.col] = humanPlayer;
            const result = await minimaxAsync(newBoard, depth - 1, alpha, beta, true, aiPlayer, scoreFunction, nodeCounter);
            if (result.score < minEval) {
                minEval = result.score;
                bestMove = move;
            }
            beta = Math.min(beta, result.score);
            if (beta <= alpha) break;
        }
        return { score: minEval, move: bestMove };
    }
};

const findBestMoveWithMinimaxAsync = async (board: BoardState, aiPlayer: Player, depth: number, scoreFunction: (b: BoardState, p: Player) => number): Promise<{ row: number; col: number }> => {
    const humanPlayer = aiPlayer === 'X' ? 'O' : 'X';
    const emptyCells = getValidMoves(board);

    // Check for an immediate winning move (fast)
    for (const cell of emptyCells) {
        const tempBoard = board.map(r => [...r]);
        tempBoard[cell.row][cell.col] = aiPlayer;
        if (checkWin(tempBoard, aiPlayer)) {
          return cell;
        }
    }

    // Check to block an immediate opponent win (fast)
    for (const cell of emptyCells) {
        const tempBoard = board.map(r => [...r]);
        tempBoard[cell.row][cell.col] = humanPlayer;
        if (checkWin(tempBoard, humanPlayer)) {
          return cell;
        }
    }
    
    // --- Tactical Threat Analysis ---
    const { bestOpponentMove, bestAiMove } = analyzeThreats(board, aiPlayer, scoreFunction);
    
    const threatThreshold = PATTERN_SCORES.LIVE_THREE;

    if (bestOpponentMove && bestOpponentMove.score >= threatThreshold) {
        if (!bestAiMove || bestOpponentMove.score > bestAiMove.score) {
            console.log(`AI (hard): Blocking critical player threat via tactical analysis.`, bestOpponentMove.move);
            return bestOpponentMove.move;
        }
    }


    // --- Optimization: Improved Move Ordering ---
    // Score each possible move based on its offensive potential (aiScore)
    // and its defensive necessity (blocking a good human move).
    const scoredMoves = [];
    for (const move of emptyCells) {
        // Score for AI's move
        const aiBoard = board.map(r => [...r]);
        aiBoard[move.row][move.col] = aiPlayer;
        const aiScore = scoreFunction(aiBoard, aiPlayer);
        
        // Score for Human's potential move in the same spot
        const humanBoard = board.map(r => [...r]);
        humanBoard[move.row][move.col] = humanPlayer;
        // Score from AI's perspective (a good human move will be a large negative number)
        const humanScore = scoreFunction(humanBoard, aiPlayer); 
        
        // The move's priority is its own potential score plus the threat it blocks.
        // We subtract humanScore because it's negative for threats, effectively adding the threat value.
        const totalScore = aiScore - humanScore; 
        scoredMoves.push({ move, score: totalScore });
    }

    scoredMoves.sort((a, b) => b.score - a.score);

    // Limit the deep search to only the top N most promising moves.
    const movesToSearch = scoredMoves.slice(0, 8).map(m => m.move);


    // If no immediate threats, run the fully async minimax on the pruned list of moves.
    const { move } = await minimaxAsync(board, depth, -Infinity, Infinity, true, aiPlayer, scoreFunction, { count: 0 }, movesToSearch);
    
    if (move && board[move.row]?.[move.col] === null) {
        return move;
    }
    
    // Fallback if the best move is somehow invalid
    console.error("Async Minimax failed to return a valid move, picking first available.");
    return emptyCells[0];
};


// --- Main AI Move Function ---
let openingBook: OpeningBook | null = null;

export const getAIMove = async (
    board: BoardState, 
    aiPlayer: Player, 
    skillLevel: 'easy' | 'medium' | 'hard',
    onThinking?: (move: { row: number, col: number }) => void
): Promise<{ row: number; col: number }> => {
    // Load the opening book on the first call
    if (openingBook === null) {
        openingBook = loadOpeningBook();
    }

    // 1. Check the opening book first for a quick, strong move.
    const bookMove = getMoveFromBook(board, openingBook);
    if (bookMove) {
        if (onThinking) {
            onThinking(bookMove);
        }
        // Return the move from the book with a very short delay to not be jarringly instant.
        return new Promise(resolve => setTimeout(() => resolve(bookMove), 150));
    }

    // 2. If no move in book, proceed with Minimax calculation.
    let depth: number;
    switch(skillLevel) {
        case 'easy':
            depth = 1;
            break;
        case 'medium':
            depth = 2;
            break;
        case 'hard':
            depth = 3; // Reduced depth for faster performance
            break;
        default:
            depth = 1;
    }

    console.log(`Local AI: Minimax (depth ${depth}) for ${skillLevel} opponent. (Opening book miss)`);

    // For all AI levels, find a quick "probable" move to show the thinking indicator immediately.
    if (onThinking) {
        // This is a synchronous, fast call to get a plausible move.
        const probableMove = findBestMoveWithMinimax(board, aiPlayer, 1, scorePositionAdvanced, skillLevel);
        onThinking(probableMove);
    }
    
    // Use the non-blocking async version for hard AI to prevent the UI from freezing.
    if (skillLevel === 'hard') {
        return findBestMoveWithMinimaxAsync(board, aiPlayer, depth, scorePositionAdvanced);
    }

    // For Easy and Medium, which are fast, add an artificial delay to simulate thinking.
    const artificialDelay = skillLevel === 'easy' 
        ? 400 + Math.random() * 300 // 400ms - 700ms
        : 800 + Math.random() * 500; // 800ms - 1300ms
    
    return new Promise(resolve => {
        setTimeout(() => {
            const move = findBestMoveWithMinimax(board, aiPlayer, depth, scorePositionAdvanced, skillLevel);
            resolve(move);
        }, artificialDelay);
    });
};
