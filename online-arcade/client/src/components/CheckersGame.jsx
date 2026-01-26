// client/src/components/CheckersGame.jsx
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';

const socketUrl = import.meta.env.PROD ? '/' : import.meta.env.VITE_API_URL;
const socket = io(socketUrl);

// --- CONSTANTS ---
const EMPTY = 0;
const RED_PAWN = 1;
const BLACK_PAWN = 2;
const RED_KING = 3;
const BLACK_KING = 4;

const INITIAL_BOARD = [
  [0, 2, 0, 2, 0, 2, 0, 2],
  [2, 0, 2, 0, 2, 0, 2, 0],
  [0, 2, 0, 2, 0, 2, 0, 2],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [1, 0, 1, 0, 1, 0, 1, 0],
  [0, 1, 0, 1, 0, 1, 0, 1],
  [1, 0, 1, 0, 1, 0, 1, 0],
];

const VICTORY_MESSAGES = [
    "{winner} OBLITERATED {loser}!",
    "{loser} needs a map.",
    "{winner} is the Checkers God.",
    "Someone call an ambulance for {loser}!",
    "{loser} just got served.",
    "{loser} fell asleep at the wheel!"
];

// --- HELPER LOGIC ---
const isMyPiece = (pieceVal, color) => {
    if (color === 'red') return pieceVal === RED_PAWN || pieceVal === RED_KING;
    if (color === 'black') return pieceVal === BLACK_PAWN || pieceVal === BLACK_KING;
    return false;
};

const getPieceColor = (pieceVal) => {
    if (pieceVal === RED_PAWN || pieceVal === RED_KING) return 'red';
    if (pieceVal === BLACK_PAWN || pieceVal === BLACK_KING) return 'black';
    return null;
};

const hasAvailableJump = (board, r, c, color) => {
    const piece = board[r][c];
    const isKing = piece === RED_KING || piece === BLACK_KING;
    const moves = [];
    if (isKing || color === 'red') moves.push([-1, -1], [-1, 1]); 
    if (isKing || color === 'black') moves.push([1, -1], [1, 1]); 
    if (isKing) { 
        if (color === 'red') moves.push([1, -1], [1, 1]);
        if (color === 'black') moves.push([-1, -1], [-1, 1]);
    }
    for (let [dr, dc] of moves) {
        const toR = r + (dr * 2);
        const toC = c + (dc * 2);
        if (toR >= 0 && toR < 8 && toC >= 0 && toC < 8) {
            const midPiece = board[r + dr][c + dc];
            const targetPiece = board[toR][toC];
            if (midPiece !== EMPTY && getPieceColor(midPiece) !== color && targetPiece === EMPTY) {
                return true;
            }
        }
    }
    return false;
};

function CheckersGame() {
  const navigate = useNavigate();
  
  // States
  const [gameState, setGameState] = useState('menu'); 
  const [roomCode, setRoomCode] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [myColor, setMyColor] = useState(null); 
  const [turn, setTurn] = useState('red'); 
  const [board, setBoard] = useState(INITIAL_BOARD);
  const [selectedPiece, setSelectedPiece] = useState(null);

  const [activeChainPiece, setActiveChainPiece] = useState(null); 
  const [timeLeft, setTimeLeft] = useState(25);
  
  const [winner, setWinner] = useState(null); 
  const [victoryMessage, setVictoryMessage] = useState('');

  const [redLost, setRedLost] = useState(0);
  const [blackLost, setBlackLost] = useState(0);

  const boardRef = useRef(board);
  const turnRef = useRef(turn);

  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { turnRef.current = turn; }, [turn]);

  // --- ACTIONS ---
  const handleForfeit = () => {
      const winningColor = myColor === 'red' ? 'black' : 'red';
      console.log("⏰ Timer hit 0. FORFEITING game. Winner:", winningColor);
      socket.emit('forfeit_game', { room: roomCode, winner: winningColor }); 
  };

  // --- TIMER ---
  useEffect(() => {
    if (gameState !== 'playing' || winner) return;

    const timer = setInterval(() => {
        setTimeLeft((prevTime) => {
            if (prevTime <= 1) {
                if (turnRef.current === myColor) {
                    setTimeout(() => handleForfeit(), 0);
                    return 0; 
                } else {
                    return 0;
                }
            }
            return prevTime - 1;
        });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, winner, myColor]);


  // --- SOCKETS ---
  useEffect(() => {
    socket.on('room_created', (code) => {
        setRoomCode(code);
        setGameState('waiting_lobby');
    });

    socket.on('game_start', (data) => {
        setMyColor(data.color);
        setRoomCode(data.room);
        setGameState('playing');
        setBoard(INITIAL_BOARD);
        setTurn('red');
        setTimeLeft(25); 
        setWinner(null); 
        setRedLost(0);
        setBlackLost(0);
    });

    socket.on('opponent_move', (data) => {
        handleMoveLocally(data.from, data.to, false);
    });

    socket.on('game_over', (data) => {
        console.log("GAME OVER RECEIVED:", data);
        triggerWin(data.winner);
    });

    socket.on('error_joining', (msg) => {
        setErrorMsg(msg);
        setTimeout(() => setErrorMsg(''), 3000);
    });

    return () => {
        socket.off('room_created');
        socket.off('game_start');
        socket.off('opponent_move');
        socket.off('game_over'); 
        socket.off('error_joining');
    };
  }, []);

  const createGame = () => socket.emit('create_room');
  const joinGame = () => { if(joinInput.length > 0) socket.emit('join_room', joinInput.toUpperCase()); };

  // --- GAMEPLAY ---
  const triggerWin = (winningColor) => {
      setWinner(winningColor);
      const wName = winningColor.toUpperCase(); 
      const lName = winningColor === 'red' ? 'BLACK' : 'RED';
      const randomMsg = VICTORY_MESSAGES[Math.floor(Math.random() * VICTORY_MESSAGES.length)];
      setVictoryMessage(randomMsg.replace('{winner}', wName).replace('{loser}', lName));
      
      const end = Date.now() + 3000;
      const colors = winningColor === 'red' ? ['#ff7675', '#d63031'] : ['#b2bec3', '#636e72'];
      (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: colors });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      }());
  };

  const updateGraveyard = (currentBoard) => {
      let redCount = 0;
      let blackCount = 0;
      currentBoard.forEach(row => {
          row.forEach(cell => {
              if (cell === RED_PAWN || cell === RED_KING) redCount++;
              if (cell === BLACK_PAWN || cell === BLACK_KING) blackCount++;
          });
      });
      setRedLost(12 - redCount);
      setBlackLost(12 - blackCount);
      if (redCount === 0) return 'black';
      if (blackCount === 0) return 'red';
      return null;
  };

  const handleMoveLocally = (from, to, shouldEmit = true) => {
      const currentBoard = boardRef.current;
      const currentTurn = turnRef.current; 

      let nextBoard = currentBoard.map(row => [...row]);
      let piece = nextBoard[from.r][from.c];
      let isJump = false;

      nextBoard[to.r][to.c] = piece;
      nextBoard[from.r][from.c] = EMPTY;

      if (Math.abs(to.r - from.r) === 2) {
          isJump = true;
          const midR = (from.r + to.r) / 2;
          const midC = (from.c + to.c) / 2;
          nextBoard[midR][midC] = EMPTY; 
      }

      let promoted = false;
      if (piece === RED_PAWN && to.r === 0) {
          nextBoard[to.r][to.c] = RED_KING;
          promoted = true;
      } else if (piece === BLACK_PAWN && to.r === 7) {
          nextBoard[to.r][to.c] = BLACK_KING;
          promoted = true;
      }

      const boardWinner = updateGraveyard(nextBoard);
      
      if (boardWinner) {
          setBoard(nextBoard);
          if (shouldEmit) socket.emit('forfeit_game', { room: roomCode, winner: boardWinner });
          return; 
      }

      let nextTurnEnded = true; 
      let nextActiveChain = null;

      if (isJump && !promoted) {
          const canJumpAgain = hasAvailableJump(nextBoard, to.r, to.c, currentTurn);
          if (canJumpAgain) {
              nextTurnEnded = false; 
              nextActiveChain = { r: to.r, c: to.c };
          }
      }

      setBoard(nextBoard);
      
      if (nextTurnEnded) {
          setTurn(prev => prev === 'red' ? 'black' : 'red');
          setTimeLeft(25); 
          setActiveChainPiece(null);
          if (shouldEmit) setSelectedPiece(null);
      } else {
          setTimeLeft(25); 
          setActiveChainPiece(nextActiveChain);
          if (shouldEmit) setSelectedPiece(nextActiveChain); 
      }

      if (shouldEmit) {
          socket.emit('make_move', { room: roomCode, move: { from, to } });
      }
  };

  const handleSquareClick = (r, c) => {
      if (gameState !== 'playing' || winner) return; 
      if (turn !== myColor) return; 

      const clickedContent = board[r][c];
      if (activeChainPiece) {
          if (isMyPiece(clickedContent, myColor)) {
              if (r !== activeChainPiece.r || c !== activeChainPiece.c) return;
          }
      }
      if (isMyPiece(clickedContent, myColor)) {
          setSelectedPiece({ r, c });
          return;
      }
      if (selectedPiece && clickedContent === EMPTY) {
          const fromR = selectedPiece.r;
          const fromC = selectedPiece.c;
          const pieceVal = board[fromR][fromC];
          const dr = r - fromR; 
          const dc = c - fromC;
          const absDr = Math.abs(dr);
          const absDc = Math.abs(dc);
          if (absDr !== absDc) return; 
          if (activeChainPiece && absDr !== 2) return;
          if (absDr !== 1 && absDr !== 2) return;
          const isKing = pieceVal === RED_KING || pieceVal === BLACK_KING;
          if (!isKing) {
            if (pieceVal === RED_PAWN && dr > 0) return;
            if (pieceVal === BLACK_PAWN && dr < 0) return;
          }
          if (absDr === 2) {
              const midR = (fromR + r) / 2;
              const midC = (fromC + c) / 2;
              const midPiece = board[midR][midC];
              if (midPiece === EMPTY || isMyPiece(midPiece, myColor)) return;
          }
          handleMoveLocally(selectedPiece, { r, c });
      }
  };

  // --- ARCADE STYLES ---
  const buttonStyle = { 
      padding: '15px 30px', fontSize: '1.2rem', cursor: 'pointer', 
      background: '#000', color: '#fff', 
      border: '2px solid #fff', 
      fontFamily: 'inherit', fontWeight: 'bold', margin: '10px',
      textTransform: 'uppercase'
  };
  
  const inputStyle = { 
      padding: '15px', fontSize: '1.2rem', 
      background: '#000', color: '#fff', border: '2px solid #fff',
      textAlign: 'center', textTransform: 'uppercase', letterSpacing: '5px',
      fontFamily: 'inherit'
  };
  
  const deadPieceStyle = (color) => ({
      width: '30px', height: '30px', borderRadius: '50%', margin: '5px',
      background: color === 'red' 
          ? 'radial-gradient(circle at 10px 10px, #ff4d4d, #b30000)' 
          : 'radial-gradient(circle at 10px 10px, #b2bec3, #636e72)',
      border: '2px solid #333', opacity: 0.5, 
      filter: 'grayscale(0.5)'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', backgroundColor: '#000', color: '#fff', fontFamily: "'Courier New', Courier, monospace" }}>
        
        {/* --- VICTORY MODAL --- */}
        {winner && (
            <div style={{
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                backgroundColor: 'rgba(0,0,0,0.95)',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                zIndex: 100, animation: 'fadeIn 0.5s'
            }}>
                <h1 style={{ fontSize: '5rem', color: '#fff', border: '4px solid #fff', padding: '20px' }}>
                    {winner.toUpperCase()} WINS
                </h1>
                <h3 style={{ fontSize: '2rem', color: '#fff', textAlign: 'center', maxWidth: '80%', marginTop: '30px' }}>
                    {victoryMessage}
                </h3>
                <button onClick={() => window.location.reload()} style={{ ...buttonStyle, marginTop: '50px' }}>
                    PLAY AGAIN
                </button>
            </div>
        )}

        {/* --- ARCADE HEADER (BRAND CORRECTED) --- */}
        <div style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            width: '90%', maxWidth: '800px',
            backgroundColor: '#000', borderBottom: '4px solid #fff',
            padding: '15px 0', marginTop: '20px', marginBottom: '40px'
        }}>
            {/* BRAND LOGO */}
            <div style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '-2px' }}>
                <span style={{ color: 'rgb(76, 209, 55)', textShadow: '0 0 5px rgb(76, 209, 55)' }}>G</span>
                <span style={{ color: 'rgb(0, 210, 211)', textShadow: '0 0 5px rgb(0, 210, 211)' }}>G</span>
                <span style={{ fontSize: '1rem', color: '#fff', fontWeight: 'normal', letterSpacing: '2px', marginLeft: '10px' }}></span>
            </div>

            {/* Center: Info */}
            {gameState === 'playing' && (
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {turn === myColor 
                        ? (activeChainPiece ? <span style={{ color: '#fdcb6e' }}>⚔️ DOUBLE JUMP!</span> : <span style={{ color: 'rgb(76, 209, 55)' }}>YOUR TURN</span>)
                        : <span style={{ color: '#ff4d4d' }}>ENEMY TURN</span>}
                </div>
            )}

            {/* Right: Timer */}
            <div style={{ textAlign: 'right' }}>
                {gameState === 'playing' ? (
                   <span style={{ fontSize: '1.5rem', color: timeLeft <= 5 ? '#ff0000' : '#fff' }}>TIME: {timeLeft}</span>
                ) : (
                   <span style={{ color: '#fff' }}>CHECKERS</span>
                )}
            </div>
        </div>

        {/* --- MAIN GAME LAYOUT --- */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '40px' }}>
            
            {/* LEFT GRAVEYARD (Red Pieces Lost) */}
            {gameState === 'playing' && (
                <div style={{ 
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '15px', border: '2px solid #fff', backgroundColor: '#111', minWidth: '60px'
                }}>
                    <div style={{ marginBottom: '10px', color: '#ff4d4d', fontWeight: 'bold', fontSize: '0.8rem' }}>RED<br/>LOST</div>
                    {Array.from({ length: redLost }).map((_, i) => <div key={i} style={deadPieceStyle('red')} />)}
                </div>
            )}

            {/* CENTER BOARD (or Menus) */}
            <div>
                {gameState === 'menu' && (
                    <div style={{ backgroundColor: '#000', padding: '60px', border: '4px solid #fff', textAlign: 'center' }}>
                        <h2 style={{ color: '#fff', marginBottom: '30px', textShadow: '0 0 5px #fff' }}>MULTIPLAYER LOBBY</h2>
                        <button onClick={createGame} style={buttonStyle}>CREATE GAME</button>
                        <div style={{ borderTop: '2px solid #fff', paddingTop: '20px', marginTop: '20px' }}>
                            <p style={{ color: '#aaa', fontSize: '0.9rem' }}>ENTER CODE</p>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
                                <input value={joinInput} onChange={(e) => setJoinInput(e.target.value)} placeholder="...." style={inputStyle} maxLength={4} />
                                <button onClick={joinGame} style={{ ...buttonStyle, margin: 0 }}>JOIN</button>
                            </div>
                            {errorMsg && <p style={{ color: '#ff0000', marginTop: '10px' }}>{errorMsg}</p>}
                        </div>
                    </div>
                )}

                {gameState === 'waiting_lobby' && (
                    <div style={{ textAlign: 'center', padding: '50px', border: '4px solid #fff' }}>
                        <h2 style={{ color: '#fff', animation: 'pulse 1s infinite' }}>WAITING FOR P2...</h2>
                        <div style={{ fontSize: '4rem', fontWeight: '900', letterSpacing: '10px', border: '2px dashed rgb(76, 209, 55)', color: 'rgb(76, 209, 55)', padding: '20px', margin: '20px 0', display: 'inline-block' }}>{roomCode}</div>
                        <p style={{ color: '#aaa' }}>SHARE CODE TO START</p>
                    </div>
                )}

                {gameState === 'playing' && (
                    <div style={{ 
                        border: '4px solid #fff', 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(8, 60px)', 
                        gridTemplateRows: 'repeat(8, 60px)',
                    }}>
                        {board.map((row, r) => (
                            row.map((cell, c) => {
                                const isDark = (r + c) % 2 === 1;
                                const isSelected = selectedPiece?.r === r && selectedPiece?.c === c;
                                const isChainActive = activeChainPiece && activeChainPiece.r === r && activeChainPiece.c === c;
                                const isPiece = cell !== EMPTY;
                                const isKing = cell === RED_KING || cell === BLACK_KING;

                                return (
                                    <div 
                                        key={`${r}-${c}`}
                                        onClick={() => handleSquareClick(r, c)}
                                        style={{
                                            width: '60px', height: '60px',
                                            backgroundColor: isDark ? '#111' : '#444',
                                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                                            cursor: (turn === myColor && isDark) ? 'pointer' : 'default',
                                            position: 'relative',
                                            border: isSelected ? '2px solid rgb(0, 210, 211)' : 'none', 
                                            boxSizing: 'border-box'
                                        }}
                                    >
                                        {isChainActive && <div style={{ position: 'absolute', width: '100%', height: '100%', border: '4px solid #fdcb6e', boxSizing: 'border-box', zIndex: 3, animation: 'pulse 1s infinite' }} />}
                                        {isPiece && (
                                            <div style={{ 
                                                width: '40px', height: '40px', borderRadius: '50%', 
                                                background: (cell === RED_PAWN || cell === RED_KING) 
                                                    ? 'radial-gradient(circle at 10px 10px, #ff4d4d, #b30000)' 
                                                    : 'radial-gradient(circle at 10px 10px, #b2bec3, #636e72)', 
                                                border: '2px solid #000',
                                                boxShadow: isKing ? '0 0 10px 2px #ffd700' : 'none', 
                                                zIndex: 1
                                            }} />
                                        )}
                                    </div>
                                );
                            })
                        ))}
                    </div>
                )}
            </div>

            {/* RIGHT GRAVEYARD (Grey Pieces Lost) */}
            {gameState === 'playing' && (
                <div style={{ 
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '15px', border: '2px solid #fff', backgroundColor: '#111', minWidth: '60px'
                }}>
                    <div style={{ marginBottom: '10px', color: '#b2bec3', fontWeight: 'bold', fontSize: '0.8rem' }}>GREY<br/>LOST</div>
                    {Array.from({ length: blackLost }).map((_, i) => <div key={i} style={deadPieceStyle('black')} />)}
                </div>
            )}
        </div>

        <button onClick={() => navigate('/')} style={{ marginTop: '30px', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.8rem' }}>← EXIT TO ARCADE</button>
    </div>
  );
}

export default CheckersGame;