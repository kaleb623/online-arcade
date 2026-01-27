// client/src/components/Connect4Game.jsx
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { socket } from '../socket'; 
import confetti from 'canvas-confetti';

// --- CONFIGURATION ---
const COLS = 7;
const ROWS = 6;
const CELL_SIZE = 80;
const PADDING = 20;
const CANVAS_WIDTH = COLS * CELL_SIZE + (PADDING * 2);
const CANVAS_HEIGHT = ROWS * CELL_SIZE + (PADDING * 2);
const BOARD_COLOR = '#2d3436';
const SLOT_RADIUS = 30;

const AudioContextClass = (window.AudioContext || window.webkitAudioContext);
const audioCtx = new AudioContextClass();

const playSound = (type, isMuted) => {
  if (isMuted || audioCtx.state === 'suspended') {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      if (isMuted) return;
  }
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  
  if (type === 'drop') {
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
  } else if (type === 'win') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554, now + 0.1);
      osc.frequency.setValueAtTime(659, now + 0.2);
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
  }
};

function Connect4Game() {
  const canvasRef = useRef();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const username = localStorage.getItem('user') || "Anonymous";
  const paramSpectate = searchParams.get('spectate');
  const spectatingTarget = (paramSpectate && paramSpectate !== username) ? paramSpectate : null;

  // --- STATE ---
  const [gameState, setGameState] = useState(spectatingTarget ? 'playing' : 'menu');
  const [roomCode, setRoomCode] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  
  const [board, setBoard] = useState(Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
  const [myPlayerNum, setMyPlayerNum] = useState(null); 
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [winner, setWinner] = useState(null); 
  const [playerNames, setPlayerNames] = useState({ 1: 'Player 1', 2: 'Player 2' });
  
  const [hoverCol, setHoverCol] = useState(-1);
  const [isSfxMuted, setIsSfxMuted] = useState(() => localStorage.getItem('c4_sfx_muted') === 'true');
  const isSfxMutedRef = useRef(isSfxMuted);

  const boardRef = useRef(board);
  const currentPlayerRef = useRef(currentPlayer);
  const playerNamesRef = useRef(playerNames);
  const winnerRef = useRef(winner); 

  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);
  useEffect(() => { playerNamesRef.current = playerNames; }, [playerNames]);
  useEffect(() => { winnerRef.current = winner; }, [winner]);

  // --- 1. AUTO-JOIN ---
  useEffect(() => {
    const roomFromUrl = searchParams.get('room');
    if (roomFromUrl && !spectatingTarget) {
      const user = localStorage.getItem('user');
      if (!user || user === "Anonymous") {
        sessionStorage.setItem('pendingRoom', roomFromUrl);
        const msg = encodeURIComponent("Please register to play Connect 4");
        navigate(`/login?mode=register&msg=${msg}`);
      } else {
        socket.emit('join_c4_room', { roomCode: roomFromUrl.toUpperCase(), username: user });
      }
    }
  }, [searchParams, navigate, spectatingTarget]);

  // --- 2. SPECTATOR CONNECTION (FIXED: Minimal Dependencies) ---
  useEffect(() => {
    if (spectatingTarget) {
      console.log(`Joined spectator room for: ${spectatingTarget}`);
      socket.emit('join_spectator', spectatingTarget);

      const handleStream = (data) => {
        setBoard(data.board);
        setCurrentPlayer(data.currentPlayer);
        setWinner(data.winner);
        if (data.names) setPlayerNames(data.names);
      };

      socket.on('live_stream', handleStream);

      return () => {
        socket.off('live_stream', handleStream);
        socket.emit('update_activity', { status: 'online', game: null });
      };
    }
  }, [spectatingTarget]); // <--- CRITICAL FIX: Only run when target changes

  // --- 3. SOCIAL PRESENCE UPDATER (Separated to avoid loops) ---
  useEffect(() => {
    if (spectatingTarget) {
        // I am watching someone
        const p1 = playerNames[1];
        const p2 = playerNames[2];
        const gameLabel = (p1 !== 'Player 1' || p2 !== 'Player 2') 
            ? `Connect 4 (${p1} vs ${p2})`
            : `Connect 4 (${spectatingTarget})`;
            
        socket.emit('update_activity', { status: 'watching', game: gameLabel });
    } 
    else if (gameState === 'playing' && !winner) {
        // I am playing
        const opponentName = myPlayerNum === 1 ? playerNames[2] : playerNames[1];
        socket.emit('update_activity', { 
            status: 'gaming', 
            game: `Connect 4 vs ${opponentName}` 
        });
    }
  }, [spectatingTarget, gameState, winner, playerNames, myPlayerNum]);

  const broadcastState = (currentBoard, currentP, winState) => {
    if (!spectatingTarget) {
        socket.emit('stream_game_data', {
            board: currentBoard,
            currentPlayer: currentP,
            winner: winState,
            status: winState ? 'gameover' : 'playing',
            names: playerNamesRef.current 
        });
    }
  };

  // --- SOCKET EVENT HANDLERS ---
  useEffect(() => {
    socket.on('c4_room_created', (code) => {
        setRoomCode(code);
        setGameState('waiting');
        socket.emit('join_c4_room', { roomCode: code, username });
    });

    socket.on('c4_game_start', (data) => {
        setMyPlayerNum(data.myPlayerNum);
        setRoomCode(data.room);
        setPlayerNames(data.names);
        setGameState('playing');
        setBoard(Array.from({ length: ROWS }, () => Array(COLS).fill(0)));
        setCurrentPlayer(1);
        setWinner(null);
    });

    socket.on('c4_opponent_move', (data) => {
        performMove(data.col, data.player);
    });

    socket.on('c4_game_over', (data) => {
        setWinner(data.winner); 
        triggerConfetti(data.winner);
        if (username !== "Anonymous" && data.winner === myPlayerNum) {
             axios.post('/api/score', { username, game: 'connect4', score: 100 }).catch(console.error);
        }
        broadcastState(boardRef.current, currentPlayerRef.current, data.winner);
    });

    // LISTEN FOR NEW SPECTATORS
    socket.on('spectator_joined', () => {
        if (!spectatingTarget && gameState === 'playing') {
            broadcastState(boardRef.current, currentPlayerRef.current, winnerRef.current);
        }
    });

    socket.on('error_joining', (msg) => {
        setErrorMsg(msg);
        setTimeout(() => setErrorMsg(''), 3000);
    });

    return () => {
        socket.off('c4_room_created');
        socket.off('c4_game_start');
        socket.off('c4_opponent_move');
        socket.off('c4_game_over');
        socket.off('spectator_joined');
        socket.off('error_joining');
    };
  }, [myPlayerNum, gameState]); 

  // --- GAME LOGIC ---
  const performMove = (col, player) => {
      const currentBoard = boardRef.current;
      const newBoard = currentBoard.map(row => [...row]);
      
      let rowToDrop = -1;
      for (let r = ROWS - 1; r >= 0; r--) {
          if (newBoard[r][col] === 0) {
              rowToDrop = r;
              break;
          }
      }
      if (rowToDrop !== -1) {
          newBoard[rowToDrop][col] = player;
          playSound('drop', isSfxMutedRef.current);
      }

      const nextPlayer = player === 1 ? 2 : 1;
      
      setBoard(newBoard);
      setCurrentPlayer(nextPlayer);
      
      // BROADCAST STATE FOR SPECTATORS
      // Use refs to ensure we send the calculated state, not stale state
      socket.emit('stream_game_data', {
          board: newBoard,
          currentPlayer: nextPlayer,
          winner: null,
          status: 'playing',
          names: playerNamesRef.current
      });
  };

  const handleDrop = (col) => {
    if (winner || spectatingTarget || gameState !== 'playing') return;
    if (currentPlayer !== myPlayerNum) return;

    let rowToDrop = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === 0) {
            rowToDrop = r;
            break;
        }
    }
    if (rowToDrop === -1) return; 

    const newBoard = board.map(row => [...row]);
    newBoard[rowToDrop][col] = myPlayerNum;
    setBoard(newBoard);
    playSound('drop', isSfxMutedRef.current);

    socket.emit('c4_make_move', { room: roomCode, col, player: myPlayerNum });

    if (checkWin(newBoard, rowToDrop, col, myPlayerNum)) {
        socket.emit('c4_game_end', { room: roomCode, winner: myPlayerNum });
        broadcastState(newBoard, myPlayerNum === 1 ? 2 : 1, myPlayerNum);
    } else if (newBoard.every(row => row.every(cell => cell !== 0))) {
        socket.emit('c4_game_end', { room: roomCode, winner: 'draw' });
        broadcastState(newBoard, myPlayerNum === 1 ? 2 : 1, 'draw');
    } else {
        const nextPlayer = myPlayerNum === 1 ? 2 : 1;
        setCurrentPlayer(nextPlayer);
        broadcastState(newBoard, nextPlayer, null); 
    }
  };

  const checkWin = (b, row, col, player) => {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let [dRow, dCol] of directions) {
        let count = 1;
        for (let i = 1; i < 4; i++) {
            const r = row + dRow * i;
            const c = col + dCol * i;
            if (r < 0 || r >= ROWS || c < 0 || c >= COLS || b[r][c] !== player) break;
            count++;
        }
        for (let i = 1; i < 4; i++) {
            const r = row - dRow * i;
            const c = col - dCol * i;
            if (r < 0 || r >= ROWS || c < 0 || c >= COLS || b[r][c] !== player) break;
            count++;
        }
        if (count >= 4) return true;
    }
    return false;
  };

  const triggerConfetti = (winningPlayer) => {
      playSound('win', isSfxMutedRef.current);
      const color = winningPlayer === 1 ? '#ff7675' : '#00d2d3';
      const end = Date.now() + 3000;
      (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: [color, '#ffffff'] });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: [color, '#ffffff'] });
        if (Date.now() < end) requestAnimationFrame(frame);
      }());
  };

  const draw = () => {
    if(!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.translate(PADDING, PADDING);
    ctx.fillStyle = BOARD_COLOR;
    ctx.fillRect(0, 0, COLS * CELL_SIZE, ROWS * CELL_SIZE);
    
    for(let r=0; r<ROWS; r++) {
        for(let c=0; c<COLS; c++) {
            const centerX = c * CELL_SIZE + CELL_SIZE / 2;
            const centerY = r * CELL_SIZE + CELL_SIZE / 2;
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, SLOT_RADIUS, 0, Math.PI * 2);
            
            if (board[r][c] === 0) {
                ctx.fillStyle = '#111'; 
            } else if (board[r][c] === 1) {
                ctx.fillStyle = '#ff7675'; 
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#ff7675';
            } else if (board[r][c] === 2) {
                ctx.fillStyle = '#00d2d3'; 
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#00d2d3';
            }
            
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.closePath();
        }
    }

    if (!winner && !spectatingTarget && hoverCol !== -1 && currentPlayer === myPlayerNum) {
        ctx.beginPath();
        const hoverX = hoverCol * CELL_SIZE + CELL_SIZE / 2;
        ctx.arc(hoverX, 0, 10, 0, Math.PI * 2);
        ctx.fillStyle = myPlayerNum === 1 ? '#ff7675' : '#00d2d3';
        ctx.fill();
        ctx.closePath();
    }
    ctx.restore();
  };

  useEffect(() => { draw(); }, [board, hoverCol, winner, spectatingTarget, currentPlayer]);

  const handleMouseMove = (e) => {
      if(spectatingTarget) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - PADDING;
      if (x < 0 || x > COLS * CELL_SIZE) { setHoverCol(-1); return; }
      setHoverCol(Math.floor(x / CELL_SIZE));
  };

  useEffect(() => {
    isSfxMutedRef.current = isSfxMuted;
    localStorage.setItem('c4_sfx_muted', isSfxMuted);
  }, [isSfxMuted]);

  const handleInputChange = (e) => {
      const val = e.target.value;
      if (val.includes('?room=')) {
          const extractedCode = new URLSearchParams(val.split('?')[1]).get('room');
          if (extractedCode) {
              setJoinInput(extractedCode.toUpperCase());
              return;
          }
      }
      setJoinInput(val.toUpperCase());
  };

  const createGame = () => socket.emit('create_c4_room');
  const joinGame = () => { if(joinInput) socket.emit('join_c4_room', { roomCode: joinInput.toUpperCase(), username }); };
  
  const copyCode = () => {
      navigator.clipboard.writeText(`${window.location.origin}/game/connect4?room=${roomCode}`)
        .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000); 
        });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', backgroundColor: '#000', color: '#fff', fontFamily: "'Courier New', Courier, monospace" }}>
        
        {gameState === 'menu' && (
            <div style={{ marginTop: '100px', border: '4px solid #fff', padding: '50px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '3rem', marginBottom: '40px' }}>CONNECT 4</h1>
                <button onClick={createGame} style={{ padding: '15px 30px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', background: '#fff', color: '#000', border: 'none', marginBottom: '20px' }}>
                    CREATE GAME
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                        value={joinInput} 
                        onChange={handleInputChange} 
                        placeholder="ROOM CODE" 
                        maxLength={50}
                        style={{ padding: '15px', fontSize: '1.2rem', textAlign: 'center', textTransform: 'uppercase', background: '#000', color: '#fff', border: '2px solid #fff' }} 
                    />
                    <button onClick={joinGame} style={{ padding: '15px', background: '#00d2d3', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>JOIN</button>
                </div>
                {errorMsg && <p style={{ color: 'red', marginTop: '10px' }}>{errorMsg}</p>}
            </div>
        )}

        {gameState === 'waiting' && (
            <div style={{ marginTop: '100px', textAlign: 'center' }}>
                <h2>WAITING FOR OPPONENT...</h2>
                <div onClick={copyCode} style={{ fontSize: '4rem', border: '2px dashed #4cd137', color: '#4cd137', padding: '20px', cursor: 'pointer', margin: '20px 0' }}>
                    {roomCode}
                </div>
                <p style={{ color: copied ? '#4cd137' : '#fff', fontWeight: copied ? 'bold' : 'normal' }}>
                    {copied ? "COPIED!" : "CLICK TO COPY INVITE LINK"}
                </p>
            </div>
        )}

        {(gameState === 'playing' || spectatingTarget) && (
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ 
                    display: 'flex', justifyContent: 'space-between', width: CANVAS_WIDTH, marginBottom: '10px',
                    borderBottom: '2px solid #333', paddingBottom: '10px'
                }}>
                    <div>
                        <span style={{ color: '#ff7675', fontWeight: 'bold' }}>{playerNames[1]}</span> VS <span style={{ color: '#00d2d3', fontWeight: 'bold' }}>{playerNames[2]}</span>
                    </div>
                    <div>
                        {winner 
                            ? (winner === 'draw' ? <span style={{color: '#fdcb6e'}}>DRAW</span> : <span style={{color: winner === 1 ? '#ff7675' : '#00d2d3'}}>WINNER!</span>)
                            : (spectatingTarget ? `WATCHING: ${playerNames[1]} VS ${playerNames[2]}` : (currentPlayer === myPlayerNum ? "YOUR TURN" : "OPPONENT'S TURN"))
                        }
                    </div>
                    <button onClick={() => setIsSfxMuted(!isSfxMuted)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>
                        {isSfxMuted ? '🔇' : '🔊'}
                    </button>
                </div>

                <div style={{ position: 'relative', border: '4px solid #fff', borderRadius: '10px' }}>
                    <canvas 
                        ref={canvasRef} 
                        width={CANVAS_WIDTH} 
                        height={CANVAS_HEIGHT}
                        onMouseMove={handleMouseMove}
                        onClick={() => handleDrop(hoverCol)}
                        style={{ display: 'block', cursor: (currentPlayer === myPlayerNum && !winner && !spectatingTarget) ? 'pointer' : 'default' }}
                    />
                    
                    {winner && (
                        <div style={{ 
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                            background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' 
                        }}>
                            <h1 style={{ fontSize: '3rem', color: winner === 1 ? '#ff7675' : (winner === 2 ? '#00d2d3' : '#fff') }}>
                                {winner === 'draw' ? 'DRAW!' : `${playerNames[winner].toUpperCase()} WINS!`}
                            </h1>
                            {!spectatingTarget && (
                                <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', fontSize: '1rem', cursor: 'pointer', marginTop: '20px' }}>
                                    PLAY AGAIN
                                </button>
                            )}
                        </div>
                    )}
                </div>
                
                <button onClick={() => navigate('/')} style={{ marginTop: '20px', background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
                    ← BACK TO ARCADE
                </button>
            </div>
        )}
    </div>
  );
}

export default Connect4Game;