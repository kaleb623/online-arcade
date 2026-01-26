// client/src/components/TetrisGame.jsx
import useGameSounds from '../hooks/useGameSounds'; 
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// --- CONFIGURATION ---
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30; // Bigger blocks for the arcade feel
const CANVAS_WIDTH = COLS * BLOCK_SIZE;
const CANVAS_HEIGHT = ROWS * BLOCK_SIZE;
const BASE_VOLUME = 0.4;

// --- TETROMINO DEFINITIONS ---
const TETROMINOS = {
  I: { shape: [[1, 1, 1, 1]], color: '#00f0f0' }, // Cyan
  J: { shape: [[1, 0, 0], [1, 1, 1]], color: '#0000f0' }, // Blue
  L: { shape: [[0, 0, 1], [1, 1, 1]], color: '#f0a000' }, // Orange
  O: { shape: [[1, 1], [1, 1]], color: '#f0f000' }, // Yellow
  S: { shape: [[0, 1, 1], [1, 1, 0]], color: '#00f000' }, // Green
  T: { shape: [[0, 1, 0], [1, 1, 1]], color: '#a000f0' }, // Purple
  Z: { shape: [[1, 1, 0], [0, 1, 1]], color: '#f00000' }  // Red
};

// --- MUSIC BRACKETS ---
const MUSIC_STAGES = [
  { limit: 1000, track: '/music/SnakeGame/stage1.mp3' }, 
  { limit: 3000, track: '/music/SnakeGame/stage2.mp3' }, 
  { limit: 6000, track: '/music/SnakeGame/stage3.mp3' }, 
  { limit: 10000, track: '/music/SnakeGame/stage4.mp3' }, 
  { limit: 20000, track: '/music/SnakeGame/stage5.mp3' }, 
  { limit: 99999, track: '/music/SnakeGame/stage6.mp3' } 
];

const STAGE_COLORS = [
  'rgba(0, 210, 211, 0.6)', 'rgba(255, 159, 67, 0.7)', 'rgba(255, 107, 107, 0.8)',
  'rgba(238, 82, 83, 0.9)', 'rgba(214, 48, 49, 1.0)', 'rgba(150, 0, 0, 1.0)'
];

// --- 🎹 SYNTH AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

const getStageIndex = (score) => {
    for (let i = 0; i < MUSIC_STAGES.length; i++) {
        if (score < MUSIC_STAGES[i].limit) return i;
    }
    return MUSIC_STAGES.length - 1; 
};

function TetrisGame() {
  const canvasRef = useRef();
  const navigate = useNavigate();

  const [gameStatus, setGameStatus] = useState('idle');
  const [score, setScore] = useState(0);
  const [countdown, setCountdown] = useState(3);
  
  const [isMusicMuted, setIsMusicMuted] = useState(() => localStorage.getItem('snake_music_muted') === 'true');
  const [isSfxMuted, setIsSfxMuted] = useState(() => localStorage.getItem('snake_sfx_muted') === 'true');
  
  // Game State Refs
  const gridRef = useRef(Array.from({ length: ROWS }, () => Array(COLS).fill(null)));
  const pieceRef = useRef(null); // { shape, color, x, y }
  const requestRef = useRef();
  const lastTimeRef = useRef(0);
  const dropCounterRef = useRef(0);
  const dropIntervalRef = useRef(1000); // Start at 1sec drop speed

  const scoreRef = useRef(0);
  const isSfxMutedRef = useRef(isSfxMuted); 
  const musicRef = useRef(new Audio());
  const currentStageIndexRef = useRef(-1); 
  const fadeIntervalRef = useRef(null); 
  const isGameOverRef = useRef(false);
  
  const username = localStorage.getItem('user') || "Anonymous";
  const currentStageIndex = getStageIndex(score);
  const currentGlowColor = STAGE_COLORS[currentStageIndex];

  // --- HELPERS ---
  const createPiece = () => {
      const types = 'IJLOSTZ';
      const type = types[Math.floor(Math.random() * types.length)];
      const def = TETROMINOS[type];
      // Center the piece
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
                  // Check bounds and grid occupancy
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
              return false; // Remove this row
          }
          return true;
      });
      // Add new empty rows at top
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

      dropCounterRef.current += deltaTime;
      if (dropCounterRef.current > dropIntervalRef.current) {
          drop();
      }
      draw();
      requestRef.current = requestAnimationFrame(update);
  };

  const drop = () => {
      if(isGameOverRef.current) return;
      const p = pieceRef.current;
      p.y++;
      if (collide(gridRef.current, p)) {
          p.y--; // Move back up
          // Lock piece
          gridRef.current = merge(gridRef.current, p);
          playSynth('drop', isSfxMutedRef.current);
          
          // Check lines
          const { newGrid, linesCleared } = checkLines(gridRef.current);
          gridRef.current = newGrid;
          
          if (linesCleared > 0) {
              const points = [0, 100, 300, 500, 800];
              scoreRef.current += points[linesCleared] * (currentStageIndex + 1); // Multiplier based on stage
              setScore(scoreRef.current);
              playSynth('clear', isSfxMutedRef.current);
              
              // Speed up
              dropIntervalRef.current = Math.max(100, 1000 - (scoreRef.current / 5));
          }

          // Spawn new
          pieceRef.current = createPiece();
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
          p.x -= dir; // Undo
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
          p.shape = oldShape; // Undo
      } else {
          playSynth('rotate', isSfxMutedRef.current);
      }
  };

  const playerDrop = () => {
       if(isGameOverRef.current || gameStatus !== 'playing') return;
       const p = pieceRef.current;
       while (!collide(gridRef.current, p)) {
           p.y++;
       }
       p.y--; // One step back
       dropCounterRef.current = dropIntervalRef.current + 1; // Force lock next frame
  };

  // --- DRAWING ---
  const draw = () => {
      const ctx = canvasRef.current.getContext('2d');
      // Background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Grid blocks
      gridRef.current.forEach((row, y) => {
          row.forEach((color, x) => {
              if (color) drawBlock(ctx, x, y, color);
          });
      });

      // Draw Active Piece
      if (pieceRef.current) {
          pieceRef.current.shape.forEach((row, y) => {
              row.forEach((value, x) => {
                  if (value) {
                      drawBlock(ctx, pieceRef.current.x + x, pieceRef.current.y + y, pieceRef.current.color);
                  }
              });
          });
      }
  };

  const drawBlock = (ctx, x, y, color) => {
      ctx.fillStyle = color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.fillRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      ctx.shadowBlur = 0; // Reset
  };

  // --- INIT & EVENTS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
        if (e.key === "ArrowLeft") playerMove(-1);
        else if (e.key === "ArrowRight") playerMove(1);
        else if (e.key === "ArrowUp") playerRotate();
        else if (e.key === "ArrowDown") {
             // Soft drop (speed up)
             dropCounterRef.current += 100;
        }
        else if (e.code === "Space") playerDrop();
        
        if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight", "Space"].indexOf(e.code) > -1) e.preventDefault();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameStatus]);

  // --- AUDIO & SYNC (Reused from Breakout) ---
  useEffect(() => { isSfxMutedRef.current = isSfxMuted; localStorage.setItem('snake_sfx_muted', isSfxMuted); }, [isSfxMuted]);
  useEffect(() => { 
    localStorage.setItem('snake_music_muted', isMusicMuted);
    if (musicRef.current) {
        musicRef.current.muted = isMusicMuted;
        if (!isMusicMuted && gameStatus === 'playing') musicRef.current.play().catch(e => {});
    }
  }, [isMusicMuted, gameStatus]);
  
  // Cleanup
  useEffect(() => {
      return () => {
          if (musicRef.current) {
              musicRef.current.pause();
              musicRef.current.currentTime = 0;
          }
          cancelAnimationFrame(requestRef.current);
      };
  }, []);

  const startGame = () => {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      setGameStatus('countdown');
      setCountdown(3);
      setScore(0);
      scoreRef.current = 0;
      gridRef.current = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      pieceRef.current = createPiece();
      dropIntervalRef.current = 1000;
      isGameOverRef.current = false;
      draw();
  };
  
  const endGame = () => {
      setGameStatus('gameover');
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
  const iconButtonStyle = { background: 'transparent', border: 'none', color: '#00cec9', fontSize: '1.5rem', cursor: 'pointer' };
  const countdownStyle = { fontSize: '10rem', color: '#ffeaa7', fontWeight: '800', textShadow: '0 0 20px rgba(255, 234, 167, 0.5)', animation: 'pulse 1s infinite' };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px', paddingBottom: '50px', fontFamily: "'Courier New', Courier, monospace" }}>
      {score >= 2000 && <SweatRain />}

      <div style={{ 
        backgroundColor: '#2d3436', padding: '20px', borderRadius: '15px', border: '5px solid #636e72', width: 'fit-content', position: 'relative', zIndex: 1, 
        transition: 'box-shadow 0.8s, border-color 0.8s', boxShadow: `0 0 60px ${currentGlowColor}`, borderColor: '#636e72' 
      }}>
        {/* HEADER */}
        <div style={{ backgroundColor: '#000', color: '#fff', padding: '10px 20px', marginBottom: '20px', borderRadius: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '2px solid #333', boxShadow: 'inset 0 0 10px rgba(0,255,255,0.1)' }}>
          <div style={{ display: 'flex', fontSize: '2rem', fontWeight: '900', fontFamily: 'sans-serif', letterSpacing: '-4px', marginRight: '20px', textShadow: '0 0 5px rgba(255,255,255,0.2)' }}>
              <span style={{ color: '#a000f0' }}>T</span><span style={{ color: '#00d2d3' }}>E</span><span style={{ color: '#f0f000' }}>T</span><span style={{ color: '#00f000' }}>R</span><span style={{ color: '#f00000' }}>I</span><span style={{ color: '#00f0f0' }}>S</span>
          </div>
          <div style={{ fontSize: '1.5rem' }}>SCORE: {String(score).padStart(4, '0')}</div>
          <div style={{ display: 'flex', gap: '10px', marginLeft: '15px' }}>
              <button onClick={() => setIsMusicMuted(!isMusicMuted)} style={iconButtonStyle}>{isMusicMuted ? '🔇' : '🎵'}</button>
              <button onClick={() => setIsSfxMuted(!isSfxMuted)} style={iconButtonStyle}>{isSfxMuted ? '🔇' : '🔊'}</button>
          </div>
        </div>

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
                <button onClick={() => navigate('/leaderboard')} style={{ ...buttonStyle, background: '#636e72', marginLeft: '10px' }}>LEADERS</button>
              </div>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center', color: '#b2bec3', marginTop: '10px', fontSize: '0.8rem' }}>ARROWS TO MOVE/ROTATE • SPACE TO DROP</div>
      </div>
    </div>
  );
}

export default TetrisGame;