// client/src/components/SnakeGame.jsx
import useGameSounds from '../hooks/useGameSounds';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// --- CONFIGURATION ---
const CANVAS_SIZE = 800; // Increased from 400 to 800 for Desktop
const SCALE = 20;
const SPEED = 60; 
const SNAKE_START = [[20, 20], [20, 21]]; // Start in the middle (40x40 grid)

function SnakeGame() {
  const canvasRef = useRef();
  const navigate = useNavigate();
  const { playSound } = useGameSounds('SnakeGame');

  // GAME STATES
  // 'idle' = Waiting to start
  // 'countdown' = 3..2..1
  // 'playing' = Snake is moving
  // 'gameover' = You died
  const [gameStatus, setGameStatus] = useState('idle');
  
  const [snake, setSnake] = useState(SNAKE_START);
  const [food, setFood] = useState([10, 10]); // Initial food somewhere safe
  const [score, setScore] = useState(0);
  const [countdown, setCountdown] = useState(5);

  // REFS (For Game Engine)
  const moveQueue = useRef([]); 
  const currentDir = useRef([0, -1]); 
  
  // TIMING REFS
  const requestRef = useRef();
  const lastTimeRef = useRef();
  const accumulatorRef = useRef(0);

  // LOGIC REFS
  const snakeRef = useRef(SNAKE_START);
  const foodRef = useRef([10, 10]);
  const scoreRef = useRef(0);

  const username = localStorage.getItem('user') || "Anonymous";

  // --- DRAWING LOOP ---
  useEffect(() => {
    const context = canvasRef.current.getContext("2d");
    context.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    // Draw Snake
    context.fillStyle = "limegreen";
    snake.forEach(([x, y]) => context.fillRect(x, y, 1, 1));
    
    // Draw Food
    context.fillStyle = "red";
    context.fillRect(food[0], food[1], 1, 1);
  }, [snake, food]); 

  // --- SYNC REFS ---
  useEffect(() => {
      snakeRef.current = snake;
      foodRef.current = food;
      scoreRef.current = score;
  }, [snake, food, score]);

  // --- COUNTDOWN TIMER ---
  useEffect(() => {
    if (gameStatus === 'countdown' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (gameStatus === 'countdown' && countdown === 0) {
      setGameStatus('playing');
    }
  }, [gameStatus, countdown]);


  // --- GAME LOGIC STEP ---
  const runGameStep = () => {
    const currentSnake = [...snakeRef.current];
    const dir = currentDir.current;
    const newHead = [currentSnake[0][0] + dir[0], currentSnake[0][1] + dir[1]];

    // Wall / Self Collision
    if (newHead[0] * SCALE >= CANVAS_SIZE || newHead[0] < 0 ||
        newHead[1] * SCALE >= CANVAS_SIZE || newHead[1] < 0 ||
        currentSnake.some(seg => seg[0] === newHead[0] && seg[1] === newHead[1])) {
        playSound('bonk', 0.6);
        endGame();
        return;
    }

    currentSnake.unshift(newHead);

    // Food Collision
    if (newHead[0] === foodRef.current[0] && newHead[1] === foodRef.current[1]) {
        scoreRef.current += 10;
        setScore(scoreRef.current);
        playSound('chomp');
        
        let newFood;
        do {
            newFood = [
                Math.floor(Math.random() * (CANVAS_SIZE / SCALE)),
                Math.floor(Math.random() * (CANVAS_SIZE / SCALE))
            ];
        } while (currentSnake.some(seg => seg[0] === newFood[0] && seg[1] === newFood[1]));
        
        foodRef.current = newFood;
        setFood(newFood);
    } else {
        currentSnake.pop();
    }

    snakeRef.current = currentSnake;
    setSnake(currentSnake);
  };

  // --- GAME LOOP ENGINE ---
  const gameLoopRefWrapper = (time) => {
      if (gameStatus !== 'playing') return;

      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;
      accumulatorRef.current += deltaTime;

      // Fixed Time Step
      while (accumulatorRef.current >= SPEED) {
          if (moveQueue.current.length > 0) {
              currentDir.current = moveQueue.current.shift();
          }
          runGameStep();
          accumulatorRef.current -= SPEED;
      }

      if(gameStatus === 'playing') {
          requestRef.current = requestAnimationFrame(gameLoopRefWrapper);
      }
  };

  // Start Loop when status becomes 'playing'
  useEffect(() => {
    if (gameStatus === 'playing') {
        requestRef.current = requestAnimationFrame((time) => {
            lastTimeRef.current = time;
            requestRef.current = requestAnimationFrame(gameLoopRefWrapper);
        });
    }
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameStatus]);


  // --- INPUTS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Allow buffering moves during countdown!
      const lastMove = moveQueue.current.length > 0 
        ? moveQueue.current[moveQueue.current.length - 1] 
        : currentDir.current;

      let newDir = null;

      if (e.key === "ArrowUp" && lastMove[1] !== 1) newDir = [0, -1];
      if (e.key === "ArrowDown" && lastMove[1] !== -1) newDir = [0, 1];
      if (e.key === "ArrowLeft" && lastMove[0] !== 1) newDir = [-1, 0];
      if (e.key === "ArrowRight" && lastMove[0] !== -1) newDir = [1, 0];

      // Prevent scrolling the page with arrows
      if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
          e.preventDefault();
      }

      if (newDir) {
        moveQueue.current.push(newDir);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- ACTIONS ---
  const startGame = () => {
    setGameStatus('countdown');
    setCountdown(5);
    // Reset Board
    setSnake(SNAKE_START);
    snakeRef.current = SNAKE_START;
    
    // Randomize initial food slightly so it's not always 10,10
    const startFood = [
        Math.floor(Math.random() * (CANVAS_SIZE / SCALE)),
        Math.floor(Math.random() * (CANVAS_SIZE / SCALE))
    ];
    setFood(startFood);
    foodRef.current = startFood;
    
    currentDir.current = [0, -1]; 
    moveQueue.current = [];
    setScore(0);
    scoreRef.current = 0;
    accumulatorRef.current = 0;
    lastTimeRef.current = null;
  };

  const endGame = () => {
    setGameStatus('gameover');
    if(username !== "Anonymous") {
        axios.post('http://localhost:5000/api/score', { 
            username, 
            game: 'snake', 
            score: scoreRef.current 
        }).catch(err => console.error(err));
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ marginBottom: '10px' }}>🐍 Snake 🐍</h2>
      <p style={{ marginBottom: '20px' }}>Player: <b>{username}</b> | Score: {score}</p>
      
      {/* Game Container */}
      <div style={{ 
          position: 'relative', 
          width: `${CANVAS_SIZE}px`, 
          height: `${CANVAS_SIZE}px`, 
          margin: '0 auto',
          border: '4px solid #333',
          backgroundColor: '#000',
          boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
      }}>
        
        <canvas
          ref={canvasRef}
          width={`${CANVAS_SIZE}px`}
          height={`${CANVAS_SIZE}px`}
          style={{ display: 'block' }} 
        />

        {/* --- OVERLAYS --- */}
        
        {/* 1. START SCREEN */}
        {gameStatus === 'idle' && (
          <div style={overlayStyle}>
            <button onClick={startGame} style={buttonStyle}>
              Start Game ▶
            </button>
          </div>
        )}

        {/* 2. COUNTDOWN */}
        {gameStatus === 'countdown' && (
          <div style={overlayStyle}>
            <div style={{
                fontSize: '8rem',
                color: '#fff',
                fontWeight: '800',
                textShadow: '0 4px 10px rgba(0,0,0,0.5)',
                animation: 'pulse 1s infinite'
            }}>
              {countdown}
            </div>
            <p style={{ color: '#fff', marginTop: '10px', fontSize: '1.2rem' }}>Get Ready!</p>
          </div>
        )}

        {/* 3. GAME OVER */}
        {gameStatus === 'gameover' && (
          <div style={overlayStyle}>
            <h3 style={{ color: 'white', fontSize: '2.5rem', margin: 0 }}>Game Over</h3>
            <p style={{ color: '#eee', fontSize: '1.2rem' }}>Final Score: {score}</p>
            <div style={{ marginTop: '20px' }}>
              <button onClick={startGame} style={buttonStyle}>
                Try Again ↺
              </button>
              <button 
                onClick={() => navigate('/leaderboard')} 
                style={{ ...buttonStyle, background: '#444', marginLeft: '10px' }}
              >
                🏆 Leaders
              </button>
            </div>
          </div>
        )}

      </div>
      
      {/* Instructions */}
      <div style={{ marginTop: '20px', color: '#666' }}>
        <small>Use Arrow Keys to Move</small>
      </div>
    </div>
  );
}

// -- STYLES --
const overlayStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0, 0, 0, 0.6)', 
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 10
};

const buttonStyle = {
  padding: '12px 24px',
  fontSize: '1.2rem',
  cursor: 'pointer',
  background: '#2ecc71',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontWeight: 'bold',
  boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
  transition: 'transform 0.1s',
};

export default SnakeGame;