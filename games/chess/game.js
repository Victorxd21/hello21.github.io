const boardElement = document.getElementById('board');
const turnIndicator = document.getElementById('turnIndicator');
const resetBtn = document.getElementById('resetBtn');

const PIECES = {
  white: {
    pawn: '♙',
    rook: '♖',
    knight: '♘',
    bishop: '♗',
    queen: '♕',
    king: '♔'
  },
  black: {
    pawn: '♟',
    rook: '♜',
    knight: '♞',
    bishop: '♝',
    queen: '♛',
    king: '♚'
  }
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

let board = [];
let selected = null;
let currentTurn = 'white';

function createEmptyBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(null));
}

function createInitialBoard() {
  const nextBoard = createEmptyBoard();
  const backRank = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

  for (let col = 0; col < 8; col += 1) {
    nextBoard[0][col] = { type: backRank[col], color: 'black' };
    nextBoard[1][col] = { type: 'pawn', color: 'black' };
    nextBoard[6][col] = { type: 'pawn', color: 'white' };
    nextBoard[7][col] = { type: backRank[col], color: 'white' };
  }

  return nextBoard;
}

function resetGame() {
  board = createInitialBoard();
  selected = null;
  currentTurn = 'white';
  turnIndicator.textContent = 'White';
  renderBoard();
}

function inBounds(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function isEnemy(piece, color) {
  return piece && piece.color !== color;
}

function getPieceAt(row, col) {
  if (!inBounds(row, col)) return null;
  return board[row][col];
}

function getLegalMoves(row, col) {
  const piece = board[row][col];
  if (!piece) return [];

  const moves = [];
  const { type, color } = piece;

  const push = (r, c) => {
    if (!inBounds(r, c)) return;
    const target = board[r][c];
    if (!target) {
      moves.push({ row: r, col: c, capture: false });
      return;
    }
    if (target.color !== color) {
      moves.push({ row: r, col: c, capture: true });
    }
  };

  switch (type) {
    case 'pawn': {
      const direction = color === 'white' ? -1 : 1;
      const startRow = color === 'white' ? 6 : 1;

      const oneAheadRow = row + direction;
      if (inBounds(oneAheadRow, col) && !board[oneAheadRow][col]) {
        moves.push({ row: oneAheadRow, col, capture: false });

        const twoAheadRow = row + direction * 2;
        if (row === startRow && !board[twoAheadRow][col]) {
          moves.push({ row: twoAheadRow, col, capture: false });
        }
      }

      [-1, 1].forEach((offset) => {
        const targetRow = row + direction;
        const targetCol = col + offset;
        if (!inBounds(targetRow, targetCol)) return;
        const target = board[targetRow][targetCol];
        if (target && target.color !== color) {
          moves.push({ row: targetRow, col: targetCol, capture: true });
        }
      });
      break;
    }
    case 'rook': {
      const directions = [[1,0],[-1,0],[0,1],[0,-1]];
      for (const [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;
        while (inBounds(r,c)) {
          const target = board[r][c];
          if (!target) {
            moves.push({ row: r, col: c, capture: false });
          } else {
            if (target.color !== color) moves.push({ row: r, col: c, capture: true });
            break;
          }
          r += dr;
          c += dc;
        }
      }
      break;
    }
    case 'bishop': {
      const directions = [[1,1],[1,-1],[-1,1],[-1,-1]];
      for (const [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;
        while (inBounds(r,c)) {
          const target = board[r][c];
          if (!target) {
            moves.push({ row: r, col: c, capture: false });
          } else {
            if (target.color !== color) moves.push({ row: r, col: c, capture: true });
            break;
          }
          r += dr;
          c += dc;
        }
      }
      break;
    }
    case 'queen': {
      const directions = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      for (const [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;
        while (inBounds(r,c)) {
          const target = board[r][c];
          if (!target) {
            moves.push({ row: r, col: c, capture: false });
          } else {
            if (target.color !== color) moves.push({ row: r, col: c, capture: true });
            break;
          }
          r += dr;
          c += dc;
        }
      }
      break;
    }
    case 'knight': {
      const offsets = [
        [2,1],[2,-1],[-2,1],[-2,-1],
        [1,2],[1,-2],[-1,2],[-1,-2]
      ];
      for (const [dr, dc] of offsets) {
        const r = row + dr;
        const c = col + dc;
        if (!inBounds(r, c)) continue;
        const target = board[r][c];
        if (!target || target.color !== color) {
          moves.push({ row: r, col: c, capture: Boolean(target && target.color !== color) });
        }
      }
      break;
    }
    case 'king': {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const r = row + dr;
          const c = col + dc;
          if (!inBounds(r, c)) continue;
          const target = board[r][c];
          if (!target || target.color !== color) {
            moves.push({ row: r, col: c, capture: Boolean(target && target.color !== color) });
          }
        }
      }
      break;
    }
    default:
      break;
  }

  return moves;
}

function renderBoard() {
  boardElement.innerHTML = '';

  const legalMoves = selected ? getLegalMoves(selected.row, selected.col).map((move) => `${move.row}-${move.col}`) : [];

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const isLight = (row + col) % 2 === 0;
      const square = document.createElement('button');
      square.type = 'button';
      square.className = `square ${isLight ? 'light' : 'dark'}`;
      square.setAttribute('role', 'gridcell');
      square.setAttribute('aria-label', `Square ${FILES[col]}${8 - row}`);

      const motionKey = `${row}-${col}`;
      const move = legalMoves.includes(motionKey);
      if (selected && selected.row === row && selected.col === col) {
        square.classList.add('selected');
      }

      const piece = board[row][col];
      if (piece) {
        const pieceNode = document.createElement('span');
        pieceNode.className = `piece ${piece.color}`;
        pieceNode.textContent = PIECES[piece.color][piece.type];
        square.appendChild(pieceNode);
      }

      if (move) {
        const target = board[row][col];
        square.classList.add(target ? 'capture' : 'legal');
      }

      square.addEventListener('click', () => handleSquareClick(row, col));
      boardElement.appendChild(square);
    }
  }
}

function handleSquareClick(row, col) {
  const piece = board[row][col];

  if (selected) {
    const legalMoves = getLegalMoves(selected.row, selected.col);
    const targetMove = legalMoves.find((move) => move.row === row && move.col === col);

    if (targetMove) {
      const movingPiece = board[selected.row][selected.col];
      board[row][col] = movingPiece;
      board[selected.row][selected.col] = null;
      currentTurn = currentTurn === 'white' ? 'black' : 'white';
      turnIndicator.textContent = currentTurn === 'white' ? 'White' : 'Black';
      selected = null;
      renderBoard();
      return;
    }

    if (piece && piece.color === currentTurn) {
      selected = { row, col };
      renderBoard();
      return;
    }

    selected = null;
    renderBoard();
    return;
  }

  if (piece && piece.color === currentTurn) {
    selected = { row, col };
    renderBoard();
  }
}

resetBtn.addEventListener('click', resetGame);
resetGame();
