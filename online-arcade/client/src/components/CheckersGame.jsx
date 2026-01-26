// client/src/components/CheckersGame.jsx
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
    "{winner} is the Checkers God.",
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
  const [searchParams] = useSearchParams();
  
  // States
  const [gameState, setGameState] = useState('menu'); 
  const [roomCode, setRoomCode] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

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

  // --- CRITICAL FIX: URL INVITE REDIRECT ---
  useEffect(() => {
    const roomFromUrl = searchParams.get('room');
    if (roomFromUrl) {
      const user = localStorage.getItem('user');
      // If no user, we handle the redirect manually here so the message passes
      if (!user || user === "Anonymous") {
        console.log("🚩 Guest detected on invite link. Storing room and redirecting...");
        sessionStorage.setItem('pendingRoom', roomFromUrl);
        const msg = encodeURIComponent("Please register to play Checkers");
        navigate(`/login?mode=register&msg=${msg}`);
      } else {
        console.log("🔗 Authenticated user joining room:", roomFromUrl);
        socket.emit('join_room', roomFromUrl.toUpperCase());
      }
    }
  }, [searchParams, navigate]);

 const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    
    // Check if modern Clipboard API is available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      // --- LEGACY FALLBACK FOR HTTP ---
      const textArea = document.createElement("textarea");
      textArea.value = inviteUrl;
      // Ensure the textarea isn't visible
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleForfeit = () => {
      const winningColor = myColor === 'red' ? 'black' : 'red';
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
                } else return 0;
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
  }, [roomCode]);

  const createGame = () => socket.emit('create_room');
  const joinGame = () => { if(joinInput.length > 0) socket.emit('join_room', joinInput.toUpperCase()); };

  // --- GAMEPLAY LOGIC ---
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
      let rCount = 0, bCount = 0;
      currentBoard.forEach(row => row.forEach(cell => {
          if (cell === RED_PAWN || cell === RED_KING) rCount++;
          if (cell === BLACK_PAWN || cell === BLACK_KING) bCount++;
      }));
      setRedLost(12 - rCount);
      setBlackLost(12 - bCount);
      if (rCount === 0) return 'black';
      if (bCount === 0) return 'red';
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
          nextBoard[(from.r + to.r) / 2][(from.c + to.c) / 2] = EMPTY; 
      }

      let promoted = false;
      if (piece === RED_PAWN && to.r === 0) { nextBoard[to.r][to.c] = RED_KING; promoted = true; }
      else if (piece === BLACK_PAWN && to.r === 7) { nextBoard[to.r][to.c] = BLACK_KING; promoted = true; }

      const boardWinner = updateGraveyard(nextBoard);
      if (boardWinner) {
          setBoard(nextBoard);
          if (shouldEmit) socket.emit('forfeit_game', { room: roomCode, winner: boardWinner });
          return; 
      }

      let nextTurnEnded = true; 
      let nextActiveChain = null;
      if (isJump && !promoted) {
          if (hasAvailableJump(nextBoard, to.r, to.c, currentTurn)) {
              nextTurnEnded = false; 
              nextActiveChain = { r: to.r, c: to.c };
          }
      }

      setBoard(nextBoard);
      setTurn(nextTurnEnded ? (currentTurn === 'red' ? 'black' : 'red') : currentTurn);
      setTimeLeft(25);
      setActiveChainPiece(nextActiveChain);
      if (shouldEmit) {
          setSelectedPiece(nextActiveChain);
          socket.emit('make_move', { room: roomCode, move: { from, to } });
      }
  };

  const handleSquareClick = (r, c) => {
      if (gameState !== 'playing' || winner || turn !== myColor) return; 
      const clickedContent = board[r][c];
      if (activeChainPiece && (r !== activeChainPiece.r || c !== activeChainPiece.c) && isMyPiece(clickedContent, myColor)) return;
      if (isMyPiece(clickedContent, myColor)) { setSelectedPiece({ r, c }); return; }

      if (selectedPiece && clickedContent === EMPTY) {
          const fromR = selectedPiece.r, fromC = selectedPiece.c;
          const dr = r - fromR, dc = c - fromC;
          const absDr = Math.abs(dr), absDc = Math.abs(dc);
          if (absDr !== absDc || (activeChainPiece && absDr !== 2) || (absDr !== 1 && absDr !== 2)) return;
          const isKing = board[fromR][fromC] === RED_KING || board[fromR][fromC] === BLACK_KING;
          if (!isKing && ((board[fromR][fromC] === RED_PAWN && dr > 0) || (board[fromR][fromC] === BLACK_PAWN && dr < 0))) return;
          if (absDr === 2) {
              const midP = board[(fromR + r) / 2][(fromC + c) / 2];
              if (midP === EMPTY || isMyPiece(midP, myColor)) return;
          }
          handleMoveLocally(selectedPiece, { r, c });
      }
  };

  // --- STYLING ---
  const buttonStyle = { padding: '15px 30px', fontSize: '1.2rem', cursor: 'pointer', background: '#000', color: '#fff', border: '2px solid #fff', fontFamily: 'inherit', fontWeight: 'bold', margin: '10px', textTransform: 'uppercase' };
  const inputStyle = { padding: '15px', fontSize: '1.2rem', background: '#000', color: '#fff', border: '2px solid #fff', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '5px', fontFamily: 'inherit' };
  const deadPieceStyle = (color) => ({ width: '30px', height: '30px', borderRadius: '50%', margin: '5px', background: color === 'red' ? 'radial-gradient(circle at 10px 10px, #ff4d4d, #b30000)' : 'radial-gradient(circle at 10px 10px, #b2bec3, #636e72)', border: '2px solid #333', opacity: 0.5, filter: 'grayscale(0.5)' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', backgroundColor: '#000', color: '#fff', fontFamily: "'Courier New', Courier, monospace" }}>
        {winner && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                <h1 style={{ fontSize: '5rem', color: '#fff', border: '4px solid #fff', padding: '20px' }}>{winner.toUpperCase()} WINS</h1>
                <h3 style={{ fontSize: '2rem', color: '#fff', textAlign: 'center', maxWidth: '80%', marginTop: '30px' }}>{victoryMessage}</h3>
                <button onClick={() => window.location.reload()} style={{ ...buttonStyle, marginTop: '50px' }}>PLAY AGAIN</button>
            </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '90%', maxWidth: '800px', borderBottom: '4px solid #fff', padding: '15px 0', marginTop: '20px', marginBottom: '40px' }}>
            <div style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '-2px' }}>
                <span style={{ color: 'rgb(76, 209, 55)', textShadow: '0 0 5px rgb(76, 209, 55)' }}>G</span>
                <span style={{ color: 'rgb(0, 210, 211)', textShadow: '0 0 5px rgb(0, 210, 211)' }}>G</span>
            </div>
            {gameState === 'playing' && (
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {turn === myColor ? (activeChainPiece ? <span style={{ color: '#fdcb6e' }}>⚔️ DOUBLE JUMP!</span> : <span style={{ color: 'rgb(76, 209, 55)' }}>YOUR TURN</span>) : <span style={{ color: '#ff4d4d' }}>ENEMY TURN</span>}
                </div>
            )}
            <div style={{ textAlign: 'right' }}>
                {gameState === 'playing' ? <span style={{ fontSize: '1.5rem', color: timeLeft <= 5 ? '#ff0000' : '#fff' }}>TIME: {timeLeft}</span> : <span style={{ color: '#fff' }}>CHECKERS</span>}
            </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: '40px' }}>
            {gameState === 'playing' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '15px', border: '2px solid #fff', backgroundColor: '#111', minWidth: '60px' }}>
                    <div style={{ marginBottom: '10px', color: '#ff4d4d', fontWeight: 'bold', fontSize: '0.8rem' }}>RED LOST</div>
                    {Array.from({ length: redLost }).map((_, i) => <div key={i} style={deadPieceStyle('red')} />)}
                </div>
            )}

            <div>
                {gameState === 'menu' && (
                    <div style={{ backgroundColor: '#000', padding: '60px', border: '4px solid #fff', textAlign: 'center' }}>
                        <h2 style={{ color: '#fff', marginBottom: '30px' }}>MULTIPLAYER LOBBY</h2>
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
                        <h2 style={{ color: '#fff', animation: 'pulse 1s infinite' }}>{copied ? "COPIED!" : "CLICK CODE TO INVITE"}</h2>
                        <div 
                            onClick={copyInviteLink}
                            style={{ fontSize: '4rem', fontWeight: '900', letterSpacing: '10px', border: '2px dashed rgb(76, 209, 55)', color: 'rgb(76, 209, 55)', padding: '20px', margin: '20px 0', display: 'inline-block', cursor: 'pointer', textShadow: '0 0 10px rgb(76, 209, 55)' }}>
                            {roomCode}
                        </div>
                        <p style={{ color: '#aaa' }}>SEND THE LINK TO A FRIEND</p>
                    </div>
                )}

                {gameState === 'playing' && (
                    <div style={{ border: '4px solid #fff', display: 'grid', gridTemplateColumns: 'repeat(8, 60px)', gridTemplateRows: 'repeat(8, 60px)' }}>
                        {board.map((row, r) => row.map((cell, c) => (
                            <div key={`${r}-${c}`} onClick={() => handleSquareClick(r, c)} style={{ width: '60px', height: '60px', backgroundColor: (r + c) % 2 === 1 ? '#111' : '#333', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                {cell !== EMPTY && (
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: (cell === RED_PAWN || cell === RED_KING) ? 'radial-gradient(circle at 10px 10px, #ff4d4d, #b30000)' : 'radial-gradient(circle at 10px 10px, #b2bec3, #636e72)', border: (selectedPiece?.r === r && selectedPiece?.c === c) ? '4px solid rgb(0, 210, 211)' : '2px solid #000' }} />
                                )}
                            </div>
                        )))}
                    </div>
                )}
            </div>

            {gameState === 'playing' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '15px', border: '2px solid #fff', backgroundColor: '#111', minWidth: '60px' }}>
                    <div style={{ marginBottom: '10px', color: '#b2bec3', fontWeight: 'bold', fontSize: '0.8rem' }}>GREY LOST</div>
                    {Array.from({ length: blackLost }).map((_, i) => <div key={i} style={deadPieceStyle('black')} />)}
                </div>
            )}
        </div>
        <button onClick={() => navigate('/')} style={{ marginTop: '30px', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.8rem' }}>← EXIT TO ARCADE</button>
    </div>
  );
}

export default CheckersGame;