// client/src/components/TetrisGame.jsx
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket'; // Integrated shared socket

// --- CONFIGURATION ---
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const CANVAS_WIDTH = COLS * BLOCK_SIZE;
const CANVAS_HEIGHT = ROWS * BLOCK_SIZE;

// --- TETROMINO DEFINITIONS ---
const TETROMINOS = {
  I: { shape: [[1, 1, 1, 1]], color: '#00f0f0' },
  J: { shape: [[1, 0, 0], [1, 1, 1]], color: '#0000f0' },
  L: { shape: [[0, 0, 1], [1, 1, 1]], color: '#f0a000' },
  O: { shape: [[1, 1], [1, 1]], color: '#f0f000' },
  S: { shape: [[0, 1, 1], [1, 1, 0]], color: '#00f0f0' },
  T: { shape: [[0, 1, 0], [1, 1, 1]], color: '#a000f0' },
  Z: { shape: [[1, 1, 0], [0, 1, 1]], color: '#f00000' }
};

// --- AUDIO HELPERS ---
const AudioContextClass = (window.AudioContext || window.webkitAudioContext);
const audioCtx = new AudioContextClass();

const playSynth = (type, isMuted) => {
  if (isMuted || audioCtx.state === 'suspended') {
      if(audioCtx.state === 'suspended') audioCtx.resume();
      if(isMuted) return;
  }
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  const now = audioCtx.currentTime;

  if (type === 'move') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
      gainNode.gain.setValueAtTime(0.05, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
  } else if (type === 'rotate') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
      gainNode.gain.setValueAtTime(0.05, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
  } else if (type === 'drop') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
  } else if (type === 'clear') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.setValueAtTime(1200, now + 0.1);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
  }
};

const SweatRain = () => {
  const [drops, setDrops] = useState([]);
  useEffect(() => {
    const interval = setInterval(() => {
      const id = Date.now();
      const isLeft = Math.random() < 0.5;
      const randomX = isLeft ? Math.random() * 20 : 80 + (Math.random() * 20); 
      const newDrop = { id, left: `${randomX}vw`, animationDuration: `${0.8 + Math.random()}s`, opacity: 0.4 + Math.random() * 0.6 };
      setDrops((prev) => [...prev, newDrop]);
      setTimeout(() => setDrops((prev) => prev.filter((d) => d.id !== id)), 2000);
    }, 100); 
    return () => clearInterval(interval);
  }, []);
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
      <style>{`@keyframes fall { 0% { transform: translateY(-50px); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(110vh); opacity: 0; } }`}</style>
      {drops.map((drop) => (
        <div key={drop.id} style={{ position: 'absolute', top: -50, left: drop.left, animation: `fall ${drop.animationDuration} linear forwards`, opacity: drop.opacity }}>
          <svg width="30" height="45" viewBox="0 0 24 24" fill="#00d2d3" style={{ filter: 'drop-shadow(0 0 5px #00d2d3)' }}><path d="M12 0C12 0 0 10 0 15C0 20 5 24 12 24C19 24 24 20 24 15C24 10 12 0 12 0Z" /></svg>
        </div>
      ))}
    </div>
  );
};

function TetrisGame() {
  const canvasRef = useRef();
  const nextCanvasRef = useRef(); 
  const navigate = useNavigate();

  const [gameStatus, setGameStatus] = useState('idle');
  const [score, setScore] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [isSfxMuted, setIsSfxMuted] = useState(() => localStorage.getItem('snake_sfx_muted') === 'true');
  
  // Game State Refs
  const gridRef = useRef(Array.from({ length: ROWS }, () => Array(COLS).fill(null)));
  const pieceRef = useRef(null); 
  const nextPieceRef = useRef(null); 
  
  const requestRef = useRef();
  const lastTimeRef = useRef(0);
  const dropCounterRef = useRef(0);
  const dropIntervalRef = useRef(1000); 
  const scoreRef = useRef(0);
  const isSfxMutedRef = useRef(isSfxMuted); 
  const isGameOverRef = useRef(false);
  const downKeyRef = useRef(false);

  const username = localStorage.getItem('user') || "Anonymous";

  // --- NEW: SOCIAL ACTIVITY SYNC ---
  useEffect(() => {
    if (gameStatus === 'playing' && !isGameOverRef.current) {
        socket.emit('update_activity', { 
            status: 'gaming', 
            game: `Tetris (Score: ${score})` 
        });
    }
  }, [score, gameStatus]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(requestRef.current);
      // Clean up activity when leaving the page
      socket.emit('update_activity', { status: 'online', game: null });
    };
  }, []);

  // --- HELPERS ---
  const createPiece = () => {
      const types = 'IJLOSTZ';
      const type = types[Math.floor(Math.random() * types.length)];
      const def = TETROMINOS[type];
      return {
          shape: def.shape,
          color: def.color,
          x: Math.floor((COLS - def.shape[0].length) / 2),
          y: 0
      };
  };

  const collide = (grid, piece) => {
      for (let y = 0; y < piece.shape.length; y++) {
          for (let x = 0; x < piece.shape[y].length; x++) {
              if (piece.shape[y][x] !== 0) {
                  const newX = piece.x + x;
                  const newY = piece.y + y;
                  if (newX < 0 || newX >= COLS || newY >= ROWS || (newY >= 0 && grid[newY][newX])) {
                      return true;
                  }
              }
          }
      }
      return false;
  };

  const merge = (grid, piece) => {
      const newGrid = grid.map(row => [...row]);
      piece.shape.forEach((row, y) => {
          row.forEach((value, x) => {
              if (value !== 0) {
                  newGrid[piece.y + y][piece.x + x] = piece.color;
              }
          });
      });
      return newGrid;
  };

  const rotate = (matrix) => {
      return matrix[0].map((_, index) => matrix.map(row => row[index]).reverse());
  };

  const checkLines = (grid) => {
      let linesCleared = 0;
      const newGrid = grid.filter(row => {
          if (row.every(cell => cell !== null)) {
              linesCleared++;
              return false; 
          }
          return true;
      });
      while (newGrid.length < ROWS) {
          newGrid.unshift(Array(COLS).fill(null));
      }
      return { newGrid, linesCleared };
  };

  // --- GAME LOGIC ---
  const update = (time) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      const currentSpeed = downKeyRef.current ? 50 : dropIntervalRef.current;

      dropCounterRef.current += deltaTime;
      if (dropCounterRef.current > currentSpeed) {
          drop();
      }
      
      draw();
      drawNext(); 
      
      requestRef.current = requestAnimationFrame(update);
  };

  const drop = () => {
      if(isGameOverRef.current) return;
      const p = pieceRef.current;
      p.y++;
      
      if (collide(gridRef.current, p)) {
          p.y--; 
          gridRef.current = merge(gridRef.current, p);
          playSynth('drop', isSfxMutedRef.current);
          
          const { newGrid, linesCleared } = checkLines(gridRef.current);
          gridRef.current = newGrid;
          
          if (linesCleared > 0) {
              const points = [0, 100, 300, 500, 800];
              scoreRef.current += points[linesCleared];
              setScore(scoreRef.current);
              playSynth('clear', isSfxMutedRef.current);
              dropIntervalRef.current = Math.max(100, 1000 - (scoreRef.current / 5));
          }

          pieceRef.current = nextPieceRef.current; 
          pieceRef.current.x = Math.floor((COLS - pieceRef.current.shape[0].length) / 2);
          pieceRef.current.y = 0;
          
          nextPieceRef.current = createPiece(); 
          
          if (collide(gridRef.current, pieceRef.current)) {
              isGameOverRef.current = true;
              endGame();
          }
      }
      dropCounterRef.current = 0;
  };

  const playerMove = (dir) => {
      if(isGameOverRef.current || gameStatus !== 'playing') return;
      const p = pieceRef.current;
      p.x += dir;
      if (collide(gridRef.current, p)) {
          p.x -= dir; 
      } else {
          playSynth('move', isSfxMutedRef.current);
      }
  };

  const playerRotate = () => {
      if(isGameOverRef.current || gameStatus !== 'playing') return;
      const p = pieceRef.current;
      const oldShape = p.shape;
      p.shape = rotate(p.shape);
      if (collide(gridRef.current, p)) {
          p.shape = oldShape; 
      } else {
          playSynth('rotate', isSfxMutedRef.current);
      }
  };

  const playerHardDrop = () => {
       if(isGameOverRef.current || gameStatus !== 'playing') return;
       const p = pieceRef.current;
       while (!collide(gridRef.current, p)) {
           p.y++;
       }
       p.y--; 
       dropCounterRef.current = dropIntervalRef.current + 1;
  };

  // --- DRAWING ---
  const drawBlock = (ctx, x, y, color, size = BLOCK_SIZE) => {
      ctx.fillStyle = color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      ctx.shadowBlur = 0; 
  };

  const draw = () => {
      if(!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      gridRef.current.forEach((row, y) => {
          row.forEach((color, x) => {
              if (color) drawBlock(ctx, x, y, color);
          });
      });

      if (pieceRef.current) {
          pieceRef.current.shape.forEach((row, y) => {
              row.forEach((value, x) => {
                  if (value) drawBlock(ctx, pieceRef.current.x + x, pieceRef.current.y + y, pieceRef.current.color);
              });
          });
      }
  };

  const drawNext = () => {
      if(!nextCanvasRef.current || !nextPieceRef.current) return;
      const ctx = nextCanvasRef.current.getContext('2d');
      const PREVIEW_SIZE = 25; 
      
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 100, 100);

      const piece = nextPieceRef.current;
      const offsetX = (4 - piece.shape[0].length) / 2;
      const offsetY = (4 - piece.shape.length) / 2;

      piece.shape.forEach((row, y) => {
          row.forEach((value, x) => {
              if (value) {
                  drawBlock(ctx, x + offsetX, y + offsetY, piece.color, PREVIEW_SIZE);
              }
          });
      });
  };

  // --- EVENTS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
        if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight", "Space"].indexOf(e.code) > -1) e.preventDefault();
        
        if (gameStatus !== 'playing') return;

        if (e.key === "ArrowLeft") playerMove(-1);
        else if (e.key === "ArrowRight") playerMove(1);
        else if (e.key === "ArrowUp" || e.key === "r" || e.key === "R") playerRotate();
        else if (e.code === "Space") playerHardDrop();
        else if (e.key === "ArrowDown") downKeyRef.current = true;
    };

    const handleKeyUp = (e) => {
        if (e.key === "ArrowDown") downKeyRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameStatus]);

  useEffect(() => { 
    isSfxMutedRef.current = isSfxMuted; 
    localStorage.setItem('snake_sfx_muted', isSfxMuted); 
  }, [isSfxMuted]);
  
  const startGame = () => {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      setGameStatus('countdown');
      setCountdown(3);
      setScore(0);
      scoreRef.current = 0;
      gridRef.current = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      
      pieceRef.current = createPiece();
      nextPieceRef.current = createPiece(); 
      
      dropIntervalRef.current = 1000;
      isGameOverRef.current = false;
      draw();
      drawNext();
  };
  
  const endGame = () => {
      setGameStatus('gameover');
      // Update activity to online upon game over
      socket.emit('update_activity', { status: 'online', game: null });
      if(username !== "Anonymous") {
          axios.post('/api/score', { username, game: 'tetris', score: scoreRef.current }).catch(console.error);
      }
  };

  useEffect(() => {
    if (gameStatus === 'countdown' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (gameStatus === 'countdown' && countdown === 0) {
      setGameStatus('playing');
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(update);
    }
  }, [gameStatus, countdown]);

  const overlayStyle = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 10 };
  const buttonStyle = { padding: '15px 30px', fontSize: '1.2rem', cursor: 'pointer', background: '#0984e3', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontFamily: "'Courier New', Courier, monospace", boxShadow: '0 5px 0 #0056b3' };
  const countdownStyle = { fontSize: '10rem', color: '#ffeaa7', fontWeight: '800', textShadow: '0 0 20px rgba(255, 234, 167, 0.5)', animation: 'pulse 1s infinite' };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px', paddingBottom: '50px', fontFamily: "'Courier New', Courier, monospace" }}>
      {score >= 2000 && <SweatRain />}

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ 
          backgroundColor: '#2d3436', padding: '20px', borderRadius: '15px', border: '5px solid #636e72', width: 'fit-content', position: 'relative', zIndex: 1, 
          boxShadow: '0 0 40px rgba(160, 0, 240, 0.4)', borderColor: '#636e72' 
        }}>
          <div style={{ position: 'relative', border: '10px solid #111', borderRadius: '4px' }}>
            <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={{ display: 'block', backgroundColor: '#000' }} />
            
            {gameStatus === 'idle' && (
              <div style={overlayStyle}><button onClick={startGame} style={buttonStyle}>INSERT COIN (START)</button></div>
            )}
            {gameStatus === 'countdown' && (
              <div style={overlayStyle}><div style={countdownStyle}>{countdown}</div><p style={{ color: '#fff', fontSize: '1.5rem' }}>GET READY</p></div>
            )}
            {gameStatus === 'gameover' && (
              <div style={overlayStyle}>
                <h3 style={{ color: '#ff7675', fontSize: '3rem', margin: 0 }}>GAME OVER</h3>
                <p style={{ color: '#fff', fontSize: '1.5rem', margin: '20px 0' }}>SCORE: {score}</p>
                <div>
                  <button onClick={startGame} style={buttonStyle}>RETRY</button>
                  <button onClick={() => navigate('/leaderboard/tetris')} style={{ ...buttonStyle, background: '#636e72', marginLeft: '10px' }}>LEADERS</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '160px' }}>
          <div style={{ backgroundColor: '#000', padding: '15px', borderRadius: '10px', border: '2px solid #333', textAlign: 'center', boxShadow: '0 0 10px rgba(160,0,240,0.2)' }}>
             <div style={{ display: 'flex', justifyContent: 'center', fontWeight: '900', fontSize: '2rem', fontFamily: 'sans-serif', letterSpacing: '-4px' }}>
                <span style={{ color: '#4cd137' }}>G</span><span style={{ color: '#00d2d3' }}>G</span>
             </div>
          </div>

          <div style={{ backgroundColor: '#2d3436', padding: '15px', borderRadius: '10px', border: '4px solid #636e72', color: '#fff' }}>
             <div style={{ color: '#b2bec3', fontSize: '0.8rem', marginBottom: '5px' }}>SCORE</div>
             <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{String(score).padStart(5, '0')}</div>
          </div>

          <div style={{ backgroundColor: '#2d3436', padding: '15px', borderRadius: '10px', border: '4px solid #636e72', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
             <div style={{ color: '#b2bec3', fontSize: '0.8rem', marginBottom: '10px' }}>NEXT PIECE</div>
             <div style={{ border: '4px solid #636e72', backgroundColor: '#000', padding: '5px', borderRadius: '4px' }}>
                <canvas ref={nextCanvasRef} width="100" height="100" style={{ display: 'block' }} />
             </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#2d3436', padding: '10px', borderRadius: '10px', border: '2px solid #333' }}>
              <button onClick={() => setIsSfxMuted(!isSfxMuted)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>{isSfxMuted ? '🔇' : '🔊'}</button>
          </div>
          
          <div style={{ color: '#636e72', fontSize: '0.7rem', textAlign: 'center', marginTop: '10px' }}>
            ↑ OR 'R' TO ROTATE<br/>HOLD ↓ FOR SPEED<br/>SPACE TO DROP
          </div>
        </div>
      </div>
    </div>
  );
}

export default TetrisGame;