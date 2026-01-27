// client/src/components/BreakoutGame.jsx
import useGameSounds from '../hooks/useGameSounds'; 
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { socket } from '../socket'; 

// --- CONFIGURATION ---
const CANVAS_SIZE = 800; // Kept large as requested
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
const BROADCAST_RATE = 50; 

const MUSIC_STAGES = [
  { limit: 500,   track: '/music/SnakeGame/stage1.mp3' }, 
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

const AudioContextClass = (window.AudioContext || window.webkitAudioContext);
const audioCtx = new AudioContextClass();

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
  const [searchParams] = useSearchParams();
  const { playSound } = useGameSounds('BreakoutGame'); 

  const username = localStorage.getItem('user') || "Anonymous";
  const paramSpectate = searchParams.get('spectate');
  const spectatingTarget = (paramSpectate && paramSpectate !== username) ? paramSpectate : null;

  const [gameStatus, setGameStatus] = useState(spectatingTarget ? 'spectating' : 'idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [countdown, setCountdown] = useState(3);
  
  const [isMusicMuted, setIsMusicMuted] = useState(() => localStorage.getItem('snake_music_muted') === 'true');
  const [isSfxMuted, setIsSfxMuted] = useState(() => localStorage.getItem('snake_sfx_muted') === 'true');
  
  const paddleRef = useRef({ x: (CANVAS_SIZE - PADDLE_WIDTH) / 2 });
  const prevPaddleRef = useRef({ x: (CANVAS_SIZE - PADDLE_WIDTH) / 2 });

  const ballRef = useRef({ x: CANVAS_SIZE/2, y: CANVAS_SIZE - 30, dx: 2.72, dy: -2.72 });
  const prevBallRef = useRef({ x: CANVAS_SIZE/2, y: CANVAS_SIZE - 30 });

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
  
  const lastBroadcastTime = useRef(0);
  const lastFrameTime = useRef(0);
  const accumulatorRef = useRef(0);

  const currentStageIndex = getStageIndex(score);
  const currentGlowColor = STAGE_COLORS[currentStageIndex];

  useEffect(() => {
    if (spectatingTarget) {
        socket.emit('join_spectator', spectatingTarget);
        console.log(`Joined spectator room for: ${spectatingTarget}`);

        socket.on('live_stream', (data) => {
            prevPaddleRef.current = { ...paddleRef.current };
            prevBallRef.current = { ...ballRef.current };

            paddleRef.current = data.paddle;
            ballRef.current = data.ball;
            bricksRef.current = data.bricks;
            
            if(scoreRef.current !== data.score) {
                scoreRef.current = data.score;
                setScore(data.score);
            }
            if(lives !== data.lives) setLives(data.lives);

            if (data.status === 'gameover' && gameStatus !== 'gameover') {
                setGameStatus('gameover');
            } else if (data.status === 'playing' && gameStatus !== 'playing') {
                setGameStatus('playing');
            }

            accumulatorRef.current = 0;
        });

        socket.emit('update_activity', { status: 'watching', game: `Breakout (${spectatingTarget})` });

        return () => {
            socket.off('live_stream');
            socket.emit('update_activity', { status: 'online', game: null });
        };
    } else if (gameStatus === 'playing' && !isGameOverRef.current) {
        socket.emit('update_activity', { 
            status: 'gaming', 
            game: `Breakout (Score: ${score})` 
        });
    }
  }, [score, gameStatus, spectatingTarget]);

  const broadcastState = (overrideStatus = null) => {
    if (!spectatingTarget) {
        const now = Date.now();
        if (now - lastBroadcastTime.current > BROADCAST_RATE) {
            socket.emit('stream_game_data', {
                paddle: paddleRef.current,
                ball: ballRef.current,
                bricks: bricksRef.current,
                score: scoreRef.current,
                lives: lives,
                status: overrideStatus || (isGameOverRef.current ? 'gameover' : gameStatus)
            });
            lastBroadcastTime.current = now;
        }
    }
  };

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
    if (gameStatus !== 'playing' && gameStatus !== 'spectating') { musicRef.current.pause(); return; }
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

  const lerp = (start, end, alpha) => start + (end - start) * alpha;

  const draw = (interpolationAlpha = 1) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

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

    let paddleX = paddleRef.current.x;
    if (spectatingTarget) {
        paddleX = lerp(prevPaddleRef.current.x, paddleRef.current.x, interpolationAlpha);
    }

    ctx.beginPath();
    ctx.rect(paddleX, CANVAS_SIZE - PADDLE_HEIGHT - 10, PADDLE_WIDTH, PADDLE_HEIGHT);
    ctx.fillStyle = "#00d2d3";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00d2d3";
    ctx.fill();
    ctx.shadowBlur = 0; 
    ctx.closePath();

    let ballX = ballRef.current.x;
    let ballY = ballRef.current.y;
    if (spectatingTarget) {
        ballX = lerp(prevBallRef.current.x, ballRef.current.x, interpolationAlpha);
        ballY = lerp(prevBallRef.current.y, ballRef.current.y, interpolationAlpha);
    }

    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI*2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.closePath();
  };

  const update = () => {
    if (isGameOverRef.current || spectatingTarget) return;

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

    broadcastState();
  };

  const resetBall = () => {
    ballRef.current = { x: CANVAS_SIZE/2, y: CANVAS_SIZE - 40, dx: 2.72, dy: -2.72 };
  };

  const loop = (time) => {
    if(isGameOverRef.current) return;

    if (!lastFrameTime.current) lastFrameTime.current = time;
    const deltaTime = time - lastFrameTime.current;
    lastFrameTime.current = time;

    if (!spectatingTarget && gameStatus === 'playing') {
        update();
        draw(1); 
    } 
    else if (spectatingTarget && (gameStatus === 'playing' || gameStatus === 'spectating')) {
        accumulatorRef.current += deltaTime;
        let alpha = Math.min(accumulatorRef.current / BROADCAST_RATE, 1);
        draw(alpha);
    }

    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    if(gameStatus === 'playing' || gameStatus === 'spectating') {
        requestRef.current = requestAnimationFrame(loop);
    } else if (gameStatus === 'idle' || gameStatus === 'countdown') {
        draw(1); 
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameStatus, lives, spectatingTarget]); 

  useEffect(() => {
    const handleKeyDown = (e) => {
        if(spectatingTarget) return; 
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
  }, [spectatingTarget]);

  const startGame = () => {
    if(spectatingTarget) return;
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
    
    broadcastState('playing');
  };

  const endGame = () => {
    setGameStatus('gameover');
    if(username !== "Anonymous" && !spectatingTarget) {
        axios.post('/api/score', { username, game: 'breakout', score: scoreRef.current }).catch(console.error);
    }
    broadcastState('gameover');
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
    <div ref={gameContainerRef} style={{ display: 'flex', justifyContent: 'center', marginTop: '10px', paddingBottom: '10px', fontFamily: "'Courier New', Courier, monospace" }}>
      {score >= 2000 && <SweatRain />}

      <div style={{ 
        backgroundColor: '#2d3436', padding: '10px', borderRadius: '15px', border: '5px solid #636e72', width: 'fit-content', position: 'relative', zIndex: 1, 
        transition: 'box-shadow 0.8s, border-color 0.8s', boxShadow: `0 0 60px ${currentGlowColor}`, borderColor: '#636e72' 
      }}>
        <div style={{ backgroundColor: '#000', color: '#fff', padding: '10px 20px', marginBottom: '20px', borderRadius: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '2px solid #333', boxShadow: 'inset 0 0 10px rgba(0,255,255,0.1)' }}>
          <div style={{ display: 'flex', fontSize: '2rem', fontWeight: '900', fontFamily: 'sans-serif', letterSpacing: '-4px', marginRight: '20px', textShadow: '0 0 5px rgba(255,255,255,0.2)' }}>
              <span style={{ color: '#4cd137' }}>G</span>
              <span style={{ color: '#00d2d3' }}>G</span>
          </div>
          
          <div style={{ fontSize: '1.5rem' }}>
            {spectatingTarget ? `WATCHING: ${spectatingTarget.toUpperCase()}` : `SCORE: ${String(score).padStart(4, '0')} | ❤️ ${lives}`}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginLeft: '15px' }}>
              <button onClick={() => setIsMusicMuted(!isMusicMuted)} style={iconButtonStyle}>{isMusicMuted ? '🔇' : '🎵'}</button>
              <button onClick={() => setIsSfxMuted(!isSfxMuted)} style={iconButtonStyle}>{isSfxMuted ? '🔇' : '🔊'}</button>
          </div>
        </div>

        <div style={{ position: 'relative', border: '4px solid #111', borderRadius: '4px' }}>
          <canvas ref={canvasRef} width={`${CANVAS_SIZE}px`} height={`${CANVAS_SIZE}px`} style={{ display: 'block', backgroundColor: '#000' }} />
          
          {gameStatus === 'idle' && !spectatingTarget && (
            <div style={overlayStyle}><button onClick={startGame} style={buttonStyle}>INSERT COIN (START)</button></div>
          )}

          {gameStatus === 'spectating' && score === 0 && (
             <div style={{...overlayStyle, backgroundColor: 'transparent', pointerEvents: 'none'}}>
                <p style={{ color: '#fff', textShadow: '0 0 5px #000' }}>WAITING FOR SIGNAL...</p>
             </div>
          )}

          {gameStatus === 'countdown' && (
            <div style={overlayStyle}><div style={countdownStyle}>{countdown}</div><p style={{ color: '#fff', fontSize: '1.5rem' }}>GET READY</p></div>
          )}

          {gameStatus === 'gameover' && (
            <div style={overlayStyle}>
              <h3 style={{ color: '#ff7675', fontSize: '3rem', margin: 0 }}>GAME OVER</h3>
              <p style={{ color: '#fff', fontSize: '1.5rem', margin: '20px 0' }}>SCORE: {score}</p>
              {!spectatingTarget ? (
                  <div>
                    <button onClick={startGame} style={buttonStyle}>RETRY</button>
                    <button onClick={() => navigate('/leaderboard/breakout')} style={{ ...buttonStyle, background: '#636e72', marginLeft: '10px' }}>LEADERS</button>
                  </div>
              ) : (
                  <div style={{ color: '#ccc', marginTop: '20px' }}>STREAM ENDED</div>
              )}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center', color: '#b2bec3', marginTop: '10px', fontSize: '0.8rem' }}>
            {spectatingTarget ? "LIVE FEED - CONTROLS DISABLED" : "LEFT/RIGHT ARROWS TO MOVE"}
        </div>
      </div>
    </div>
  );
}

export default BreakoutGame;