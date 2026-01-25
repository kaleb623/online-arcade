// client/src/components/BreakoutGame.jsx
import useGameSounds from '../hooks/useGameSounds'; 
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// --- CONFIGURATION ---
const CANVAS_SIZE = 800; 
const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 20;
const BALL_RADIUS = 8;
const BRICK_ROW_COUNT = 8;
const BRICK_COL_COUNT = 10;
const BRICK_PADDING = 10;
const BRICK_OFFSET_TOP = 60;
const BRICK_OFFSET_LEFT = 35;
const BRICK_WIDTH = (CANVAS_SIZE - (BRICK_OFFSET_LEFT * 2) - (BRICK_PADDING * (BRICK_COL_COUNT - 1))) / BRICK_COL_COUNT;

const BASE_VOLUME = 0.4;

const MUSIC_STAGES = [
  { limit: 500,  track: '/music/SnakeGame/stage1.mp3' }, 
  { limit: 1000, track: '/music/SnakeGame/stage2.mp3' }, 
  { limit: 2000, track: '/music/SnakeGame/stage3.mp3' }, 
  { limit: 3500, track: '/music/SnakeGame/stage4.mp3' }, 
  { limit: 5000, track: '/music/SnakeGame/stage5.mp3' }, 
  { limit: 99999, track: '/music/SnakeGame/stage6.mp3' } 
];

const STAGE_COLORS = [
  'rgba(0, 210, 211, 0.6)', 'rgba(255, 159, 67, 0.7)', 'rgba(255, 107, 107, 0.8)',
  'rgba(238, 82, 83, 0.9)', 'rgba(214, 48, 49, 1.0)', 'rgba(150, 0, 0, 1.0)'
];

// --- 🎹 THE SYNTHESIZER ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const playPopSound = (isMuted, velocity = 1) => {
  if (isMuted || audioCtx.state === 'suspended') {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      if (isMuted) return;
  }
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  const baseFreq = 300; 
  const pitchMod = Math.min(velocity * 10, 200); 
  
  osc.type = 'sine'; 
  osc.frequency.setValueAtTime(baseFreq + pitchMod, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(baseFreq/2, audioCtx.currentTime + 0.1);

  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1); 
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

function BreakoutGame() {
  const canvasRef = useRef();
  const gameContainerRef = useRef(null); 
  const navigate = useNavigate();
  
  const { playSound } = useGameSounds('BreakoutGame'); 

  const [gameStatus, setGameStatus] = useState('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [countdown, setCountdown] = useState(3);
  
  const [isMusicMuted, setIsMusicMuted] = useState(() => localStorage.getItem('snake_music_muted') === 'true');
  const [isSfxMuted, setIsSfxMuted] = useState(() => localStorage.getItem('snake_sfx_muted') === 'true');
  
  const paddleRef = useRef({ x: (CANVAS_SIZE - PADDLE_WIDTH) / 2 });
  
  // --- SPEED ADJUSTMENT: 3.2 -> 2.72 (-15%) ---
  const ballRef = useRef({ x: CANVAS_SIZE/2, y: CANVAS_SIZE - 30, dx: 2.72, dy: -2.72 });
  
  const bricksRef = useRef(
      Array.from({ length: BRICK_COL_COUNT }, () => 
          Array.from({ length: BRICK_ROW_COUNT }, () => ({ x: 0, y: 0, status: 1 }))
      )
  );
  
  const leftPressed = useRef(false);
  const rightPressed = useRef(false);
  const scoreRef = useRef(0);
  const requestRef = useRef();
  
  const isSfxMutedRef = useRef(isSfxMuted); 
  const musicRef = useRef(new Audio());
  const currentStageIndexRef = useRef(-1); 
  const fadeIntervalRef = useRef(null); 
  const isGameOverRef = useRef(false);
  
  const username = localStorage.getItem('user') || "Anonymous";

  const currentStageIndex = getStageIndex(score);
  const currentGlowColor = STAGE_COLORS[currentStageIndex];

  const initBricks = () => {
      const newBricks = [];
      for(let c=0; c<BRICK_COL_COUNT; c++) {
          newBricks[c] = [];
          for(let r=0; r<BRICK_ROW_COUNT; r++) {
              newBricks[c][r] = { x: 0, y: 0, status: 1 };
          }
      }
      bricksRef.current = newBricks;
  };

  useEffect(() => { isSfxMutedRef.current = isSfxMuted; localStorage.setItem('snake_sfx_muted', isSfxMuted); }, [isSfxMuted]);
  useEffect(() => { 
    localStorage.setItem('snake_music_muted', isMusicMuted);
    if (musicRef.current) {
        musicRef.current.muted = isMusicMuted;
        if (!isMusicMuted && gameStatus === 'playing') {
             if(musicRef.current.volume === 0) musicRef.current.volume = BASE_VOLUME;
             musicRef.current.play().catch(e => {});
        }
    }
  }, [isMusicMuted, gameStatus]);

  // --- CLEANUP ON UNMOUNT ---
  useEffect(() => {
    return () => {
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current.currentTime = 0;
      }
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    };
  }, []);
  
  useEffect(() => {
    if (gameContainerRef.current) {
      setTimeout(() => {
        if(gameContainerRef.current) {
            gameContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
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
        if (progress >= 1) { clearInterval(fadeIntervalRef.current); if (onComplete) onComplete(); }
    }, 50); 
  };

  useEffect(() => {
    if (gameStatus !== 'playing') { musicRef.current.pause(); return; }
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
            musicRef.current.play().catch(e => {});
        } else {
            fadeAudioTo(0, 1500, () => {
                musicRef.current.src = newTrack;
                musicRef.current.loop = true;
                musicRef.current.play().catch(e => {});
                fadeAudioTo(BASE_VOLUME, 1500);
            });
        }
    }
    const prevLimit = stageIndex === 0 ? 0 : MUSIC_STAGES[stageIndex - 1].limit;
    const bracketSize = MUSIC_STAGES[stageIndex].limit - prevLimit;
    const progressInBracket = Math.min((score - prevLimit) / bracketSize, 1);
    if (musicRef.current) musicRef.current.playbackRate = 1.0 + (progressInBracket * 0.6);

  }, [score, gameStatus, isMusicMuted]);

  const draw = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if(!bricksRef.current || bricksRef.current.length === 0) return;

    for(let c=0; c<BRICK_COL_COUNT; c++) {
        for(let r=0; r<BRICK_ROW_COUNT; r++) {
            if(bricksRef.current[c] && bricksRef.current[c][r] && bricksRef.current[c][r].status === 1) {
                const brickX = (c * (BRICK_WIDTH + BRICK_PADDING)) + BRICK_OFFSET_LEFT;
                const brickY = (r * (30 + BRICK_PADDING)) + BRICK_OFFSET_TOP;
                bricksRef.current[c][r].x = brickX;
                bricksRef.current[c][r].y = brickY;
                const colors = ["#d63031", "#e17055", "#fdcb6e", "#00b894", "#0984e3", "#6c5ce7"];
                ctx.beginPath();
                ctx.rect(brickX, brickY, BRICK_WIDTH, 30);
                ctx.fillStyle = colors[r % colors.length];
                ctx.fill();
                ctx.closePath();
            }
        }
    }

    ctx.beginPath();
    ctx.rect(paddleRef.current.x, CANVAS_SIZE - PADDLE_HEIGHT - 10, PADDLE_WIDTH, PADDLE_HEIGHT);
    ctx.fillStyle = "#00d2d3";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00d2d3";
    ctx.fill();
    ctx.shadowBlur = 0; 
    ctx.closePath();

    ctx.beginPath();
    ctx.arc(ballRef.current.x, ballRef.current.y, BALL_RADIUS, 0, Math.PI*2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.closePath();
  };

  const update = () => {
    if (isGameOverRef.current) return;

    if(rightPressed.current && paddleRef.current.x < CANVAS_SIZE - PADDLE_WIDTH) {
        paddleRef.current.x += 7;
    }
    else if(leftPressed.current && paddleRef.current.x > 0) {
        paddleRef.current.x -= 7;
    }

    let b = ballRef.current;
    b.x += b.dx;
    b.y += b.dy;
    
    const totalVelocity = Math.sqrt(b.dx*b.dx + b.dy*b.dy);

    if(b.x + b.dx > CANVAS_SIZE - BALL_RADIUS || b.x + b.dx < BALL_RADIUS) {
        b.dx = -b.dx;
    }
    if(b.y + b.dy < BALL_RADIUS) {
        b.dy = -b.dy;
    }
    
    if(b.y + b.dy > CANVAS_SIZE - BALL_RADIUS - PADDLE_HEIGHT - 10) {
        if(b.x > paddleRef.current.x && b.x < paddleRef.current.x + PADDLE_WIDTH) {
            const hitPoint = (b.x - paddleRef.current.x) / PADDLE_WIDTH;
            
            // --- REDUCED ENGLISH: 8 -> 6.8 (-15%) ---
            b.dx = (hitPoint - 0.5) * 6.8; 
            b.dy = -(Math.abs(b.dy) * 1.02); 
        } 
        else if (b.y + b.dy > CANVAS_SIZE - BALL_RADIUS) {
            if(lives > 1) {
                setLives(l => l - 1);
                if(!isSfxMutedRef.current) playSound('loss');
                resetBall();
            } else {
                if(!isSfxMutedRef.current) playSound('loss');
                isGameOverRef.current = true;
                endGame();
                return;
            }
        }
    }

    for(let c=0; c<BRICK_COL_COUNT; c++) {
        for(let r=0; r<BRICK_ROW_COUNT; r++) {
            if(!bricksRef.current[c]) continue; 
            let brick = bricksRef.current[c][r];
            if(brick && brick.status === 1) {
                if(b.x > brick.x && b.x < brick.x + BRICK_WIDTH && b.y > brick.y && b.y < brick.y + 30) {
                    b.dy = -b.dy;
                    brick.status = 0;
                    scoreRef.current += 20;
                    setScore(scoreRef.current);
                    playPopSound(isSfxMutedRef.current, totalVelocity);
                }
            }
        }
    }
  };

  const resetBall = () => {
    // --- RESET SPEED: 2.72 ---
    ballRef.current = { x: CANVAS_SIZE/2, y: CANVAS_SIZE - 40, dx: 2.72, dy: -2.72 };
  };

  const loop = () => {
    if(gameStatus === 'playing' && !isGameOverRef.current) {
        update();
        draw();
        requestRef.current = requestAnimationFrame(loop);
    }
  };

  useEffect(() => {
    if(gameStatus === 'playing') {
        requestRef.current = requestAnimationFrame(loop);
    } else if (gameStatus === 'idle' || gameStatus === 'countdown') {
        draw(); 
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameStatus, lives]); 

  useEffect(() => {
    const handleKeyDown = (e) => {
        if(e.key === "Right" || e.key === "ArrowRight") rightPressed.current = true;
        if(e.key === "Left" || e.key === "ArrowLeft") leftPressed.current = true;
    };
    const handleKeyUp = (e) => {
        if(e.key === "Right" || e.key === "ArrowRight") rightPressed.current = false;
        if(e.key === "Left" || e.key === "ArrowLeft") leftPressed.current = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const startGame = () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    initBricks();
    setGameStatus('countdown');
    setCountdown(3);
    setScore(0);
    setLives(3);
    scoreRef.current = 0;
    isGameOverRef.current = false;
    currentStageIndexRef.current = -1;
    resetBall();
    if(fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
  };

  const endGame = () => {
    setGameStatus('gameover');
    if(username !== "Anonymous") {
        axios.post('/api/score', { username, game: 'breakout', score: scoreRef.current }).catch(console.error);
    }
  };

  useEffect(() => {
    if (gameStatus === 'countdown' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (gameStatus === 'countdown' && countdown === 0) {
      setGameStatus('playing');
    }
  }, [gameStatus, countdown]);

  const overlayStyle = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 10 };
  const buttonStyle = { padding: '15px 30px', fontSize: '1.2rem', cursor: 'pointer', background: '#0984e3', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontFamily: "'Courier New', Courier, monospace", boxShadow: '0 5px 0 #0056b3' };
  const iconButtonStyle = { background: 'transparent', border: 'none', color: '#00cec9', fontSize: '1.5rem', cursor: 'pointer' };
  const countdownStyle = { fontSize: '10rem', color: '#ffeaa7', fontWeight: '800', textShadow: '0 0 20px rgba(255, 234, 167, 0.5)', animation: 'pulse 1s infinite' };

  return (
    <div ref={gameContainerRef} style={{ display: 'flex', justifyContent: 'center', marginTop: '40px', paddingBottom: '50px', fontFamily: "'Courier New', Courier, monospace" }}>
      {score >= 2000 && <SweatRain />}

      <div style={{ 
        backgroundColor: '#2d3436', padding: '20px', borderRadius: '15px', border: '5px solid #636e72', width: 'fit-content', position: 'relative', zIndex: 1, 
        transition: 'box-shadow 0.8s, border-color 0.8s', boxShadow: `0 0 60px ${currentGlowColor}`, borderColor: '#636e72' 
      }}>
        {/* --- HEADER (GG LOGO) --- */}
        <div style={{ backgroundColor: '#000', color: '#fff', padding: '10px 20px', marginBottom: '20px', borderRadius: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '2px solid #333', boxShadow: 'inset 0 0 10px rgba(0,255,255,0.1)' }}>
          <div style={{ display: 'flex', fontSize: '2rem', fontWeight: '900', fontFamily: 'sans-serif', letterSpacing: '-4px', marginRight: '20px', textShadow: '0 0 5px rgba(255,255,255,0.2)' }}>
              <span style={{ color: '#4cd137' }}>G</span>
              <span style={{ color: '#00d2d3' }}>G</span>
          </div>
          <div style={{ fontSize: '1.5rem' }}>SCORE: {String(score).padStart(4, '0')} | ❤️ {lives}</div>
          <div style={{ display: 'flex', gap: '10px', marginLeft: '15px' }}>
              <button onClick={() => setIsMusicMuted(!isMusicMuted)} style={iconButtonStyle}>{isMusicMuted ? '🔇' : '🎵'}</button>
              <button onClick={() => setIsSfxMuted(!isSfxMuted)} style={iconButtonStyle}>{isSfxMuted ? '🔇' : '🔊'}</button>
          </div>
        </div>

        <div style={{ position: 'relative', border: '10px solid #111', borderRadius: '4px' }}>
          <canvas ref={canvasRef} width={`${CANVAS_SIZE}px`} height={`${CANVAS_SIZE}px`} style={{ display: 'block', backgroundColor: '#000' }} />
          
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
        <div style={{ textAlign: 'center', color: '#b2bec3', marginTop: '10px', fontSize: '0.8rem' }}>LEFT/RIGHT ARROWS TO MOVE</div>
      </div>
    </div>
  );
}

export default BreakoutGame;