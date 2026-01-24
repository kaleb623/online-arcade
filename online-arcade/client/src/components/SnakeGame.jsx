// client/src/components/SnakeGame.jsx
import useGameSounds from '../hooks/useGameSounds';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// --- CONFIGURATION ---
const CANVAS_SIZE = 800; 
const SCALE = 20;
const TICK_RATE = 80; 
const SNAKE_START = [[20, 20], [20, 21]]; 
const CHOMP_COOLDOWN = 15000; 

function SnakeGame() {
  const canvasRef = useRef();
  const gameContainerRef = useRef(null); 
  const navigate = useNavigate();
  const { playSound } = useGameSounds('SnakeGame');

  const [gameStatus, setGameStatus] = useState('idle');
  const [score, setScore] = useState(0);
  const [countdown, setCountdown] = useState(5);
  
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('snake_muted') === 'true';
  });

  // LOGIC REFS
  const moveQueue = useRef([]); 
  const currentDir = useRef([0, -1]); 
  const snakeRef = useRef(SNAKE_START);
  const prevSnakeRef = useRef(SNAKE_START); 
  const foodRef = useRef([10, 10]);
  const scoreRef = useRef(0);
  
  // TIMING REFS
  const requestRef = useRef();
  const lastTimeRef = useRef();
  const accumulatorRef = useRef(0);
  const lastChompTimeRef = useRef(0);
  const isMutedRef = useRef(isMuted);

  const username = localStorage.getItem('user') || "Anonymous";

  // --- AUTO SCROLL EFFECT ---
  useEffect(() => {
    if (gameContainerRef.current) {
        setTimeout(() => {
            gameContainerRef.current.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' // Aligns top of Game to Top of Screen (Header disappears)
            });
        }, 100);
    }
  }, []);

  useEffect(() => {
    isMutedRef.current = isMuted;
    localStorage.setItem('snake_muted', isMuted);
  }, [isMuted]);

  // --- INTERPOLATION & DRAWING ---
  const lerp = (start, end, alpha) => start + (end - start) * alpha;

  const draw = (alpha) => {
    const context = canvasRef.current.getContext("2d");
    context.setTransform(SCALE, 0, 0, SCALE, 0, 0); 
    context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw Food
    context.font = "1px Arial"; 
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("🍎", foodRef.current[0] + 0.5, foodRef.current[1] + 0.55);

    // Draw Snake
    context.fillStyle = "#2ecc71"; 
    
    snakeRef.current.forEach((segment, i) => {
      const prevSegment = prevSnakeRef.current[i] || segment;
      const dist = Math.abs(segment[0] - prevSegment[0]) + Math.abs(segment[1] - prevSegment[1]);
      
      let x = segment[0];
      let y = segment[1];

      if (dist < 2) { 
        x = lerp(prevSegment[0], segment[0], alpha);
        y = lerp(prevSegment[1], segment[1], alpha);
      }

      if (i === 0) {
        // --- DRAW HEAD (Tongue Emoji 👅) ---
        context.save();
        context.translate(x + 0.5, y + 0.5);

        const dir = currentDir.current;
        let angle = 0;
        
        if (dir[1] === 1) angle = 0;             
        if (dir[1] === -1) angle = Math.PI;      
        if (dir[0] === 1) angle = -Math.PI / 2;  
        if (dir[0] === -1) angle = Math.PI / 2;  

        context.rotate(angle);
        context.font = "1.2px Arial"; 
        context.fillText("👅", 0, 0.1); 
        context.restore();
      } else {
        // --- DRAW BODY ---
        context.fillRect(x + 0.05, y + 0.05, 0.9, 0.9); 
      }
    });
  };

  // --- GAME LOGIC ---
  const runGameStep = () => {
    prevSnakeRef.current = [...snakeRef.current];
    const currentSnake = [...snakeRef.current];
    const dir = currentDir.current;
    const newHead = [currentSnake[0][0] + dir[0], currentSnake[0][1] + dir[1]];

    // Collision
    if (newHead[0] * SCALE >= CANVAS_SIZE || newHead[0] < 0 ||
        newHead[1] * SCALE >= CANVAS_SIZE || newHead[1] < 0 ||
        currentSnake.some(seg => seg[0] === newHead[0] && seg[1] === newHead[1])) {
        if (!isMutedRef.current) playSound('bonk', 0.6);
        endGame();
        return;
    }

    currentSnake.unshift(newHead);

    // Food
    if (newHead[0] === foodRef.current[0] && newHead[1] === foodRef.current[1]) {
        scoreRef.current += 10;
        setScore(scoreRef.current); 
        
        const now = Date.now();
        if (!isMutedRef.current && now - lastChompTimeRef.current > CHOMP_COOLDOWN) {
            playSound('chomp');
            lastChompTimeRef.current = now;
        }
        
        let newFood;
        do {
            newFood = [
                Math.floor(Math.random() * (CANVAS_SIZE / SCALE)),
                Math.floor(Math.random() * (CANVAS_SIZE / SCALE))
            ];
        } while (currentSnake.some(seg => seg[0] === newFood[0] && seg[1] === newFood[1]));
        foodRef.current = newFood;
    } else {
        currentSnake.pop();
    }
    snakeRef.current = currentSnake;
  };

  // --- LOOP & INPUTS ---
  const gameLoopRefWrapper = (time) => {
      if (gameStatus !== 'playing') return;
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;
      accumulatorRef.current += deltaTime;

      while (accumulatorRef.current >= TICK_RATE) {
          if (moveQueue.current.length > 0) currentDir.current = moveQueue.current.shift();
          runGameStep();
          accumulatorRef.current -= TICK_RATE;
      }

      if(gameStatus === 'playing') {
          draw(accumulatorRef.current / TICK_RATE);
          requestRef.current = requestAnimationFrame(gameLoopRefWrapper);
      }
  };

  useEffect(() => {
    if (gameStatus === 'playing') {
        requestRef.current = requestAnimationFrame((time) => {
            lastTimeRef.current = time;
            requestRef.current = requestAnimationFrame(gameLoopRefWrapper);
        });
    } else if (gameStatus === 'idle' || gameStatus === 'countdown') {
         draw(1);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [gameStatus]);

  useEffect(() => {
    if (gameStatus === 'countdown' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (gameStatus === 'countdown' && countdown === 0) {
      setGameStatus('playing');
    }
  }, [gameStatus, countdown]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const lastMove = moveQueue.current.length > 0 ? moveQueue.current[moveQueue.current.length - 1] : currentDir.current;
      let newDir = null;
      if (e.key === "ArrowUp" && lastMove[1] !== 1) newDir = [0, -1];
      if (e.key === "ArrowDown" && lastMove[1] !== -1) newDir = [0, 1];
      if (e.key === "ArrowLeft" && lastMove[0] !== 1) newDir = [-1, 0];
      if (e.key === "ArrowRight" && lastMove[0] !== -1) newDir = [1, 0];
      if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) e.preventDefault();
      if (newDir) moveQueue.current.push(newDir);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const startGame = () => {
    setGameStatus('countdown');
    setCountdown(5);
    const startFood = [Math.floor(Math.random() * (CANVAS_SIZE / SCALE)), Math.floor(Math.random() * (CANVAS_SIZE / SCALE))];
    setScore(0);
    scoreRef.current = 0;
    snakeRef.current = SNAKE_START;
    prevSnakeRef.current = SNAKE_START; 
    foodRef.current = startFood;
    currentDir.current = [0, -1]; 
    moveQueue.current = [];
    accumulatorRef.current = 0;
    lastTimeRef.current = null;
    lastChompTimeRef.current = 0;
    draw(1);
  };

  const endGame = () => {
    setGameStatus('gameover');
    if(username !== "Anonymous") {
        axios.post('http://localhost:5000/api/score', { username, game: 'snake', score: scoreRef.current })
            .catch(err => console.error(err));
    }
  };

  // --- RENDER ---
  return (
    <div 
        ref={gameContainerRef}
        style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            marginTop: '40px', 
            paddingBottom: '50px', 
            fontFamily: "'Courier New', Courier, monospace",
            // Removed scrollMarginTop as it's not needed for static headers
        }}
    >
      
      {/* 1. THE CABINET */}
      <div style={{ 
        backgroundColor: '#2d3436', 
        padding: '20px', 
        borderRadius: '15px', 
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        border: '5px solid #636e72'
      }}>

        {/* 2. THE HEADER */}
        <div style={{ 
          backgroundColor: '#000', 
          color: '#00cec9', 
          padding: '10px 20px', 
          marginBottom: '20px',
          borderRadius: '5px',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          border: '2px solid #333',
          boxShadow: 'inset 0 0 10px rgba(0,255,255,0.1)'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>🐍 SNAKE</div>
          <div style={{ fontSize: '1.5rem' }}>SCORE: {String(score).padStart(4, '0')}</div>
          
          <button 
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? "Unmute" : "Mute"}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: isMuted ? '#fab1a0' : '#00cec9', 
              fontSize: '1.5rem', 
              cursor: 'pointer' 
            }}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>

        {/* 3. THE SCREEN */}
        <div style={{ position: 'relative', border: '10px solid #111', borderRadius: '4px' }}>
          <canvas
            ref={canvasRef}
            width={`${CANVAS_SIZE}px`}
            height={`${CANVAS_SIZE}px`}
            style={{ display: 'block', backgroundColor: '#000' }} 
          />

          {gameStatus === 'idle' && (
            <div style={overlayStyle}>
              <button onClick={startGame} style={buttonStyle}>INSERT COIN (START)</button>
            </div>
          )}

          {gameStatus === 'countdown' && (
            <div style={overlayStyle}>
              <div style={countdownStyle}>{countdown}</div>
              <p style={{ color: '#fff', marginTop: '10px', fontSize: '1.5rem', textShadow: '0 0 10px #fff' }}>GET READY</p>
            </div>
          )}

          {gameStatus === 'gameover' && (
            <div style={overlayStyle}>
              <h3 style={{ color: '#ff7675', fontSize: '3rem', margin: 0, textShadow: '4px 4px 0 #000' }}>GAME OVER</h3>
              <p style={{ color: '#fff', fontSize: '1.5rem', margin: '20px 0' }}>SCORE: {score}</p>
              <div>
                <button onClick={startGame} style={buttonStyle}>RETRY</button>
                <button onClick={() => navigate('/leaderboard')} style={{ ...buttonStyle, background: '#636e72', marginLeft: '10px' }}>LEADERS</button>
              </div>
            </div>
          )}
        </div>
        
        <div style={{ textAlign: 'center', color: '#b2bec3', marginTop: '10px', fontSize: '0.8rem' }}>
          USE ARROW KEYS TO MOVE
        </div>

      </div>
    </div>
  );
}

// --- STYLES ---
const overlayStyle = {
  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
  backgroundColor: 'rgba(0, 0, 0, 0.7)', 
  display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
  zIndex: 10
};

const buttonStyle = {
  padding: '15px 30px', fontSize: '1.2rem', cursor: 'pointer',
  background: '#0984e3', color: 'white', border: 'none', borderRadius: '5px',
  fontWeight: 'bold', fontFamily: "'Courier New', Courier, monospace",
  boxShadow: '0 5px 0 #0056b3',
  transform: 'translateY(0)',
  transition: 'transform 0.1s, box-shadow 0.1s'
};

const countdownStyle = {
  fontSize: '10rem', color: '#ffeaa7', fontWeight: '800', 
  textShadow: '0 0 20px rgba(255, 234, 167, 0.5)',
  animation: 'pulse 1s infinite'
};

export default SnakeGame;