// client/src/components/SnakeGame.jsx
import useGameSounds from '../hooks/useGameSounds';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { socket } from '../socket'; 

// --- CONFIGURATION ---
const CANVAS_SIZE = 800; 
const SCALE = 20;
const TICK_RATE = 80; 
const SNAKE_START = [[20, 20], [20, 21]]; 
const CHOMP_COOLDOWN = 15000; 
const BASE_VOLUME = 0.4;

// --- 🎵 MUSIC BRACKETS ---
const MUSIC_STAGES = [
  { limit: 150,   track: '/music/SnakeGame/stage1.mp3' }, 
  { limit: 300,   track: '/music/SnakeGame/stage2.mp3' }, 
  { limit: 600,   track: '/music/SnakeGame/stage3.mp3' }, 
  { limit: 1000, track: '/music/SnakeGame/stage4.mp3' }, 
  { limit: 2000, track: '/music/SnakeGame/stage5.mp3' }, 
  { limit: 99999, track: '/music/SnakeGame/stage6.mp3' } 
];

const STAGE_COLORS = [
  'rgba(0, 210, 211, 0.6)', 
  'rgba(255, 159, 67, 0.7)', 
  'rgba(255, 107, 107, 0.8)',
  'rgba(238, 82, 83, 0.9)', 
  'rgba(214, 48, 49, 1.0)', 
  'rgba(150, 0, 0, 1.0)' 
];

// --- 💧 SWEAT RAIN COMPONENT ---
const SweatRain = () => {
  const [drops, setDrops] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const id = Date.now();
      const isLeft = Math.random() < 0.5;
      const randomX = isLeft ? Math.random() * 20 : 80 + (Math.random() * 20); 

      const newDrop = {
        id,
        left: `${randomX}vw`,
        animationDuration: `${0.8 + Math.random()}s`, 
        opacity: 0.4 + Math.random() * 0.6
      };
      setDrops((prev) => [...prev, newDrop]);
      setTimeout(() => setDrops((prev) => prev.filter((d) => d.id !== id)), 2000);
    }, 100); 

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
      <style>{`
          @keyframes fall {
            0% { transform: translateY(-50px); opacity: 0; }
            20% { opacity: 1; }
            100% { transform: translateY(110vh); opacity: 0; }
          }
      `}</style>
      {drops.map((drop) => (
        <div key={drop.id} style={{
            position: 'absolute', top: -50, left: drop.left,
            animation: `fall ${drop.animationDuration} linear forwards`, opacity: drop.opacity
          }}>
          <svg width="30" height="45" viewBox="0 0 24 24" fill="#00d2d3" style={{ filter: 'drop-shadow(0 0 5px #00d2d3)' }}>
             <path d="M12 0C12 0 0 10 0 15C0 20 5 24 12 24C19 24 24 20 24 15C24 10 12 0 12 0Z" />
          </svg>
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

function SnakeGame() {
  const canvasRef = useRef();
  const gameContainerRef = useRef(null); 
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { playSound } = useGameSounds('SnakeGame');

  const spectatingTarget = searchParams.get('spectate');

  const [gameStatus, setGameStatus] = useState(spectatingTarget ? 'spectating' : 'idle');
  const [score, setScore] = useState(0);
  const [countdown, setCountdown] = useState(5);
  
  const [isMusicMuted, setIsMusicMuted] = useState(() => localStorage.getItem('snake_music_muted') === 'true');
  const [isSfxMuted, setIsSfxMuted] = useState(() => localStorage.getItem('snake_sfx_muted') === 'true');
  
  const moveQueue = useRef([]); 
  const currentDir = useRef([0, -1]); 
  const snakeRef = useRef(SNAKE_START);
  const prevSnakeRef = useRef(SNAKE_START); 
  const foodRef = useRef([10, 10]);
  const scoreRef = useRef(0);
  const requestRef = useRef();
  const lastTimeRef = useRef();
  const accumulatorRef = useRef(0);
  const lastChompTimeRef = useRef(0);
  
  const isSfxMutedRef = useRef(isSfxMuted); 
  const musicRef = useRef(new Audio());
  const currentStageIndexRef = useRef(-1); 
  const fadeIntervalRef = useRef(null); 
  const isGameOverRef = useRef(false);
  const hasBonkedRef = useRef(false); 
  const foodEmojiRef = useRef('🍆'); 
  const pooDropRef = useRef(0); 
  
  const username = localStorage.getItem('user') || "Anonymous";

  const currentStageIndex = getStageIndex(score);
  const currentGlowColor = STAGE_COLORS[currentStageIndex];

  // --- SOCIAL & SPECTATOR SYNC ---
  useEffect(() => {
    if (spectatingTarget) {
        socket.emit('join_spectator', spectatingTarget);
        console.log(`Joined spectator room for: ${spectatingTarget}`);

        socket.on('live_stream', (data) => {
            snakeRef.current = data.snake;
            foodRef.current = data.food;
            scoreRef.current = data.score;
            foodEmojiRef.current = data.emoji;
            
            // FIX: Update the direction so the head rotates correctly
            if (data.dir) currentDir.current = data.dir; 
            
            setScore(data.score);
            draw(1);
        });

        socket.emit('update_activity', { status: 'watching', game: `Snake (${spectatingTarget})` });

        return () => {
            socket.off('live_stream');
            socket.emit('update_activity', { status: 'online', game: null });
        };
    } else if (gameStatus === 'playing' && !isGameOverRef.current) {
        socket.emit('update_activity', { 
            status: 'gaming', 
            game: `Snake (Score: ${score})` 
        });
    }
  }, [score, gameStatus, spectatingTarget]);

  // --- STANDARD GAME LOGIC ---
  useEffect(() => {
    if (gameContainerRef.current) {
        setTimeout(() => {
            gameContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
  }, []);

  useEffect(() => {
    isSfxMutedRef.current = isSfxMuted;
    localStorage.setItem('snake_sfx_muted', isSfxMuted);
  }, [isSfxMuted]);

  useEffect(() => {
    localStorage.setItem('snake_music_muted', isMusicMuted);
    if (musicRef.current) {
        musicRef.current.muted = isMusicMuted;
        if (!isMusicMuted && (gameStatus === 'playing' || gameStatus === 'spectating')) {
             if(musicRef.current.volume === 0) musicRef.current.volume = BASE_VOLUME;
             musicRef.current.play().catch(e => console.log("Audio play blocked:", e));
        }
    }
  }, [isMusicMuted, gameStatus]);

  useEffect(() => {
    return () => {
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current.currentTime = 0; 
      }
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      socket.emit('update_activity', { status: 'online', game: null });
    };
  }, []);

  const fadeAudioTo = (targetVolume, duration = 1000, onComplete) => {
    if (!musicRef.current) return;
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    const startVolume = musicRef.current.volume;
    const startTime = Date.now();
    fadeIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1); 
        const newVol = startVolume + (targetVolume - startVolume) * progress;
        musicRef.current.volume = Math.max(0, Math.min(1, newVol));
        if (progress >= 1) {
            clearInterval(fadeIntervalRef.current);
            if (onComplete) onComplete();
        }
    }, 50); 
  };

  useEffect(() => {
    if (gameStatus !== 'playing' && gameStatus !== 'spectating') {
        musicRef.current.pause();
        return;
    }

    const stageIndex = getStageIndex(score);

    if (currentStageIndexRef.current !== stageIndex) {
        const previousStage = currentStageIndexRef.current;
        currentStageIndexRef.current = stageIndex;
        const newTrack = MUSIC_STAGES[stageIndex].track;

        if (previousStage === -1) {
            musicRef.current.src = newTrack;
            musicRef.current.loop = true;
            musicRef.current.volume = BASE_VOLUME; 
            musicRef.current.muted = isMusicMuted;
            musicRef.current.play().catch(e => console.log("Music start error:", e));
        } else {
            fadeAudioTo(0, 1500, () => {
                musicRef.current.src = newTrack;
                musicRef.current.loop = true;
                musicRef.current.play().catch(e => console.log("Music swap error:", e));
                fadeAudioTo(BASE_VOLUME, 1500);
            });
        }
    }

    const prevLimit = stageIndex === 0 ? 0 : MUSIC_STAGES[stageIndex - 1].limit;
    const nextLimit = MUSIC_STAGES[stageIndex].limit;
    const bracketSize = nextLimit - prevLimit;
    const progressInBracket = Math.min((score - prevLimit) / bracketSize, 1);
    const newPlaybackRate = 1.0 + (progressInBracket * 0.6);
    
    if (musicRef.current) {
        musicRef.current.playbackRate = newPlaybackRate;
    }
  }, [score, gameStatus, isMusicMuted]);

  const lerp = (start, end, alpha) => start + (end - start) * alpha;

  const draw = (alpha) => {
    const context = canvasRef.current.getContext("2d");
    context.setTransform(SCALE, 0, 0, SCALE, 0, 0); 
    context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (foodRef.current && foodRef.current.length === 2) {
      context.font = "1px Arial"; 
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(foodEmojiRef.current, foodRef.current[0] + 0.5, foodRef.current[1] + 0.55);
    }

    if (pooDropRef.current > 0) {
        const snake = snakeRef.current;
        const prevSnake = prevSnakeRef.current;
        const tailIndex = snake.length - 1;
        const currTail = snake[tailIndex];
        const prevTail = prevSnake[tailIndex] || currTail;
        let tailX = currTail[0];
        let tailY = currTail[1];
        const dist = Math.abs(currTail[0] - prevTail[0]) + Math.abs(currTail[1] - prevTail[1]);
        if (dist < 2) {
             tailX = lerp(prevTail[0], currTail[0], alpha);
             tailY = lerp(prevTail[1], currTail[1], alpha);
        }
        const beforeTail = snake[snake.length - 2] || currTail;
        const dx = currTail[0] - beforeTail[0];
        const dy = currTail[1] - beforeTail[1];
        const emissionX = tailX + dx;
        const emissionY = tailY + dy;
        context.save();
        context.translate(emissionX + 0.5, emissionY + 0.55);
        context.font = "1.2px Arial";
        context.fillText("💩", 0, 0);
        context.restore();
    }

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
        context.save();
        context.translate(x + 0.5, y + 0.5);
        
        // --- ROTATION FIX ---
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
        context.fillRect(x + 0.05, y + 0.05, 0.9, 0.9); 
      }
    });
  };

  const runGameStep = () => {
    if (spectatingTarget) return; 

    if (isGameOverRef.current) return;
    if (pooDropRef.current > 0) pooDropRef.current -= 1;
    
    prevSnakeRef.current = [...snakeRef.current];
    const currentSnake = [...snakeRef.current];
    const dir = currentDir.current;
    const newHead = [currentSnake[0][0] + dir[0], currentSnake[0][1] + dir[1]];

    if (newHead[0] * SCALE >= CANVAS_SIZE || newHead[0] < 0 ||
        newHead[1] * SCALE >= CANVAS_SIZE || newHead[1] < 0 ||
        currentSnake.some(seg => seg[0] === newHead[0] && seg[1] === newHead[1])) {
        
        isGameOverRef.current = true;
        socket.emit('update_activity', { status: 'online', game: null });
        if(musicRef.current) {
            musicRef.current.pause();
            musicRef.current.currentTime = 0; 
        }
        if(fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        if (!isSfxMutedRef.current && !hasBonkedRef.current) {
            playSound('bonk', 0.6);
            hasBonkedRef.current = true;
        }
        endGame();
        return;
    }
    currentSnake.unshift(newHead);

    if (newHead[0] === foodRef.current[0] && newHead[1] === foodRef.current[1]) {
        scoreRef.current += 10;
        setScore(scoreRef.current); 
        foodEmojiRef.current = foodEmojiRef.current === '🍆' ? '🍑' : '🍆';
        pooDropRef.current = 8; 
        const now = Date.now();
        if (!isSfxMutedRef.current && now - lastChompTimeRef.current > CHOMP_COOLDOWN) {
            playSound('chomp');
            lastChompTimeRef.current = now;
        }
        let newFood;
        let attempts = 0;
        do {
            newFood = [
                Math.floor(Math.random() * (CANVAS_SIZE / SCALE)),
                Math.floor(Math.random() * (CANVAS_SIZE / SCALE))
            ];
            attempts++;
        } while (
            currentSnake.some(seg => seg[0] === newFood[0] && seg[1] === newFood[1]) && 
            attempts < 100 
        );
        foodRef.current = newFood;
    } else {
        currentSnake.pop();
    }
    snakeRef.current = currentSnake;

    // --- EMIT GAME DATA FOR SPECTATORS ---
    socket.emit('stream_game_data', {
        snake: snakeRef.current,
        food: foodRef.current,
        score: scoreRef.current,
        emoji: foodEmojiRef.current,
        dir: currentDir.current // <--- FIX: SENDING DIRECTION NOW
    });
  };

  // ... (Rest of the file remains exactly the same as before)
  
  const gameLoopRefWrapper = (time) => {
      if ((gameStatus !== 'playing' && gameStatus !== 'spectating') || isGameOverRef.current) return;
      
      if (!lastTimeRef.current) lastTimeRef.current = time;
      let deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;
      if (deltaTime > 250) deltaTime = 250; 
      accumulatorRef.current += deltaTime;
      
      while (accumulatorRef.current >= TICK_RATE) {
          if (moveQueue.current.length > 0) currentDir.current = moveQueue.current.shift();
          runGameStep(); 
          if (isGameOverRef.current) break;
          accumulatorRef.current -= TICK_RATE;
      }
      if((gameStatus === 'playing' || gameStatus === 'spectating') && !isGameOverRef.current) {
          draw(accumulatorRef.current / TICK_RATE);
          requestRef.current = requestAnimationFrame(gameLoopRefWrapper);
      }
  };

  useEffect(() => {
    if (gameStatus === 'playing' || gameStatus === 'spectating') {
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
      if (spectatingTarget) return;

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
  }, [spectatingTarget]);

  const startGame = () => {
    if (spectatingTarget) return; 
    setGameStatus('countdown');
    setCountdown(5);
    const startFood = [Math.floor(Math.random() * (CANVAS_SIZE / SCALE)), Math.floor(Math.random() * (CANVAS_SIZE / SCALE))];
    setScore(0);
    scoreRef.current = 0;
    snakeRef.current = SNAKE_START;
    prevSnakeRef.current = SNAKE_START; 
    foodRef.current = startFood;
    foodEmojiRef.current = '🍆';
    pooDropRef.current = 0;
    isGameOverRef.current = false; 
    hasBonkedRef.current = false;
    currentStageIndexRef.current = -1;
    if(fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    
    currentDir.current = [0, -1]; 
    moveQueue.current = [];
    accumulatorRef.current = 0;
    lastTimeRef.current = null;
    lastChompTimeRef.current = 0;
    draw(1);
  };

  const endGame = () => {
    setGameStatus('gameover');
    if(username !== "Anonymous" && !spectatingTarget) {
        axios.post('/api/score', { username, game: 'snake', score: scoreRef.current })
            .catch(err => console.error(err));
    }
  };

  return (
    <div 
        ref={gameContainerRef}
        style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            marginTop: '40px', 
            paddingBottom: '50px', 
            fontFamily: "'Courier New', Courier, monospace",
        }}
    >
        {score >= 800 && <SweatRain />}

      <div style={{ 
        backgroundColor: '#2d3436', 
        padding: '20px', 
        borderRadius: '15px', 
        border: '5px solid #636e72',
        width: 'fit-content',
        position: 'relative',
        zIndex: 1,
        transition: 'box-shadow 0.8s, border-color 0.8s',
        boxShadow: `0 0 60px ${currentGlowColor}`,
        borderColor: '#636e72',
      }}>
        <div style={{ 
          backgroundColor: '#000', 
          color: '#fff', 
          padding: '10px 20px', 
          marginBottom: '20px',
          borderRadius: '5px',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          border: '2px solid #333',
          boxShadow: 'inset 0 0 10px rgba(0,255,255,0.1)'
        }}>
          <div style={{ 
              display: 'flex', fontSize: '2rem', fontWeight: '900', fontFamily: 'sans-serif',
              letterSpacing: '-4px', marginRight: '20px', textShadow: '0 0 5px rgba(255,255,255,0.2)'
          }}>
              <span style={{ color: '#4cd137' }}>G</span>
              <span style={{ color: '#00d2d3' }}>G</span>
          </div>
          
          <div style={{ fontSize: '1.5rem' }}>
            {spectatingTarget ? `WATCHING: ${spectatingTarget.toUpperCase()}` : `SCORE: ${String(score).padStart(4, '0')}`}
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginLeft: '15px' }}>
              <button onClick={() => setIsMusicMuted(!isMusicMuted)} style={iconButtonStyle}>
                {isMusicMuted ? '🔇' : '🎵'}
              </button>
              <button onClick={() => setIsSfxMuted(!isSfxMuted)} style={iconButtonStyle}>
                {isSfxMuted ? '🔇' : '🔊'}
              </button>
          </div>

        </div>
        <div style={{ position: 'relative', border: '10px solid #111', borderRadius: '4px' }}>
          <canvas ref={canvasRef} width={`${CANVAS_SIZE}px`} height={`${CANVAS_SIZE}px`} style={{ display: 'block', backgroundColor: '#000' }} />
          
          {gameStatus === 'idle' && !spectatingTarget && (
            <div style={overlayStyle}>
              <button onClick={startGame} style={buttonStyle}>INSERT COIN (START)</button>
            </div>
          )}
          
          {gameStatus === 'spectating' && score === 0 && (
             <div style={{...overlayStyle, backgroundColor: 'transparent', pointerEvents: 'none'}}>
                <p style={{ color: '#fff', textShadow: '0 0 5px #000' }}>WAITING FOR SIGNAL...</p>
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
              {!spectatingTarget && (
                  <div>
                    <button onClick={startGame} style={buttonStyle}>RETRY</button>
                    <button onClick={() => navigate('/leaderboard/snake')} style={{ ...buttonStyle, background: '#636e72', marginLeft: '10px' }}>LEADERS</button>
                  </div>
              )}
              {spectatingTarget && (
                  <div style={{ color: '#ccc', marginTop: '20px' }}>
                      STREAM ENDED
                  </div>
              )}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center', color: '#b2bec3', marginTop: '10px', fontSize: '0.8rem' }}>
          {spectatingTarget ? "LIVE FEED - CONTROLS DISABLED" : "USE ARROW KEYS TO MOVE"}
        </div>
      </div>
    </div>
  );
}

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

const iconButtonStyle = {
  background: 'transparent', border: 'none', 
  color: '#00cec9', fontSize: '1.5rem', cursor: 'pointer' 
};

const countdownStyle = {
  fontSize: '10rem', color: '#ffeaa7', fontWeight: '800', 
  textShadow: '0 0 20px rgba(255, 234, 167, 0.5)',
  animation: 'pulse 1s infinite'
};

export default SnakeGame;