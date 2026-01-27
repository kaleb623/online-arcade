// client/src/components/NeonTilesGame.jsx
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { socket } from '../socket'; 

// --- CONFIGURATION ---
const GRID_SIZE = 4; 
const TARGET_COUNT = 3; 
const START_TIME = 10.00;
const CHECKPOINT_STEP = 40;     
const CHECKPOINT_BONUS = 10.00; 

// Colors
const COLOR_BG = '#fff';
const COLOR_TARGET = '#000';
const COLOR_SUCCESS = '#00e676'; // Vibrant Neon Green
const COLOR_FAIL = '#ff7675';

// Dimensions
const BOARD_SIZE = 550;

const AudioContextClass = (window.AudioContext || window.webkitAudioContext);
const audioCtx = new AudioContextClass();

const playReflexSound = (type, isMuted, timeSinceLastClick) => {
  if (isMuted || audioCtx.state === 'suspended') {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      if (isMuted) return;
  }
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  
  if (type === 'tap') {
      const safeGap = Math.max(timeSinceLastClick, 100); 
      const baseFreq = 400 + (100000 / safeGap) * 0.5; 
      const freq = Math.min(baseFreq, 1200); 

      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.08); 
      
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      
      osc.start(now);
      osc.stop(now + 0.08);
  } else if (type === 'loss') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.5);
      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
  } else if (type === 'checkpoint') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
  }
};

function NeonTilesGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const username = localStorage.getItem('user') || "Anonymous";
  const paramSpectate = searchParams.get('spectate');
  const spectatingTarget = (paramSpectate && paramSpectate !== username) ? paramSpectate : null;

  // --- STATE ---
  const [gameState, setGameState] = useState(spectatingTarget ? 'playing' : 'idle'); 
  const [score, setScore] = useState(0);      
  const [multiplier, setMultiplier] = useState(1.0);
  const [timeLeft, setTimeLeft] = useState(START_TIME);
  const [activeIndices, setActiveIndices] = useState([]); 
  const [effects, setEffects] = useState({}); 

  const [isSfxMuted, setIsSfxMuted] = useState(() => localStorage.getItem('tiles_sfx_muted') === 'true');
  const isSfxMutedRef = useRef(isSfxMuted);
  const timerRef = useRef(null);
  const lastClickTimeRef = useRef(Date.now());
  const hitsRef = useRef(0);

  // --- LOGIC ---
  const initGame = () => {
      const newActive = [];
      while(newActive.length < TARGET_COUNT) {
          const r = Math.floor(Math.random() * (GRID_SIZE * GRID_SIZE));
          if(!newActive.includes(r)) newActive.push(r);
      }
      setActiveIndices(newActive);
      setEffects({});
      setScore(0);
      setMultiplier(1.0);
      setTimeLeft(START_TIME);
      setGameState('playing');
      lastClickTimeRef.current = Date.now();
      hitsRef.current = 0;
      if (audioCtx.state === 'suspended') audioCtx.resume();
  };

  useEffect(() => {
      if (gameState === 'playing' && !spectatingTarget) {
          timerRef.current = setInterval(() => {
              setTimeLeft(prev => {
                  if (prev <= 0) {
                      clearInterval(timerRef.current);
                      handleGameOver();
                      return 0;
                  }
                  return prev - 0.01; 
              });
          }, 10);
      }
      return () => clearInterval(timerRef.current);
  }, [gameState, spectatingTarget]);

  const handleTileClick = (index) => {
      if (gameState !== 'playing' || spectatingTarget) return;

      const now = Date.now();
      const timeDiff = now - lastClickTimeRef.current;
      lastClickTimeRef.current = now;

      if (activeIndices.includes(index)) {
          // --- SUCCESS ---
          playReflexSound('tap', isSfxMutedRef.current, timeDiff);
          
          triggerEffect(index, 'success');

          const rawPoints = 1;
          const newScore = Math.floor(score + (rawPoints * multiplier * 100));
          setScore(newScore);

          setActiveIndices(prev => {
              const remaining = prev.filter(i => i !== index);
              let newSpot;
              do {
                  newSpot = Math.floor(Math.random() * (GRID_SIZE * GRID_SIZE));
              } while (remaining.includes(newSpot) || newSpot === index);
              return [...remaining, newSpot];
          });

          hitsRef.current = (hitsRef.current || 0) + 1;
          if (hitsRef.current % CHECKPOINT_STEP === 0) {
              setTimeLeft(t => t + CHECKPOINT_BONUS);
              setMultiplier(m => m + 0.03);
              playReflexSound('checkpoint', isSfxMutedRef.current, 0);
          }

          broadcastState();

      } else {
          // --- FAIL ---
          triggerEffect(index, 'fail');
          handleGameOver();
      }
  };

  const triggerEffect = (index, type) => {
      const id = Date.now();
      setEffects(prev => ({ ...prev, [index]: { type, id } }));
      
      setTimeout(() => {
          setEffects(prev => {
              const next = { ...prev };
              if (next[index] && next[index].id === id) delete next[index];
              return next;
          });
      }, 125); 
  };

  const handleGameOver = () => {
      setGameState('gameover');
      playReflexSound('loss', isSfxMutedRef.current, 0);
      hitsRef.current = 0;
      if(username !== "Anonymous" && !spectatingTarget) {
          axios.post('/api/score', { username, game: 'neontiles', score: score }).catch(console.error);
      }
      broadcastState('gameover');
  };

  // --- SPECTATOR ---
  useEffect(() => {
      if (spectatingTarget) {
          socket.emit('join_spectator', spectatingTarget);
          socket.on('live_stream', (data) => {
              setActiveIndices(data.activeIndices);
              setScore(data.score);
              setTimeLeft(data.timeLeft);
              if(data.status === 'gameover' && gameState !== 'gameover') {
                  setGameState('gameover');
              } else if (data.status === 'playing' && gameState !== 'playing') {
                  setGameState('playing');
              }
          });
          socket.emit('update_activity', { status: 'watching', game: `Neon Tiles (${spectatingTarget})` });
          return () => {
              socket.off('live_stream');
              socket.emit('update_activity', { status: 'online', game: null });
          };
      } else if (gameState === 'playing') {
          socket.emit('update_activity', { status: 'gaming', game: `Neon Tiles (Score: ${score})` });
      }
  }, [spectatingTarget, gameState, score]);

  const broadcastState = (statusOverride) => {
      if(spectatingTarget) return;
      socket.emit('stream_game_data', {
          activeIndices,
          score,
          timeLeft,
          status: statusOverride || gameState
      });
  };

  // --- RENDER HELPERS ---
  const renderGrid = () => {
      const tiles = [];
      for(let i=0; i<GRID_SIZE*GRID_SIZE; i++) {
          const isActive = activeIndices.includes(i);
          const effect = effects[i];
          
          let bgColor = isActive ? COLOR_TARGET : COLOR_BG;
          if (effect) {
              bgColor = effect.type === 'success' ? COLOR_SUCCESS : COLOR_FAIL;
          }

          tiles.push(
              <div 
                  key={i}
                  onMouseDown={(e) => { e.preventDefault(); handleTileClick(i); }}
                  onTouchStart={(e) => { e.preventDefault(); handleTileClick(i); }}
                  style={{
                      backgroundColor: bgColor,
                      border: '1px solid #eee',
                      position: 'relative',
                      cursor: spectatingTarget ? 'default' : 'pointer',
                      transition: 'none', 
                      display: 'flex', justifyContent: 'center', alignItems: 'center'
                  }}
              >
                  {effect && effect.type === 'success' && (
                      <div style={{
                          position: 'absolute', color: '#fff', fontSize: '2rem', fontWeight: 'bold',
                          animation: 'floatUp 0.15s ease-out forwards', pointerEvents: 'none'
                      }}>+1</div>
                  )}
              </div>
          );
      }
      return tiles;
  };

  useEffect(() => {
    isSfxMutedRef.current = isSfxMuted;
    localStorage.setItem('tiles_sfx_muted', isSfxMuted);
  }, [isSfxMuted]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px', fontFamily: "'Courier New', Courier, monospace" }}>
        
        <style>{`
            @keyframes floatUp {
                0% { transform: scale(1); opacity: 1; }
                100% { transform: scale(1.5); opacity: 0; }
            }
        `}</style>

        {/* HEADER */}
        <div style={{ 
            width: `${BOARD_SIZE}px`, backgroundColor: '#2d3436', color: '#fff', padding: '15px 20px', 
            borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            boxSizing: 'border-box'
        }}>
            <div style={{display:'flex', gap:'15px', alignItems:'baseline'}}>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#00e676' }}>{score}</div>
                <div style={{ fontSize: '0.9rem', color: '#b2bec3' }}>x{multiplier.toFixed(2)}</div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: timeLeft < 3 ? '#ff7675' : '#fff' }}>
                {timeLeft.toFixed(2)}s
            </div>
            <button onClick={() => setIsSfxMuted(!isSfxMuted)} style={{ background: 'none', border: 'none', color: '#00cec9', cursor: 'pointer', fontSize: '1.2rem' }}>
                {isSfxMuted ? '🔇' : '🔊'}
            </button>
        </div>

        {/* GAME BOARD */}
        <div style={{ 
            width: `${BOARD_SIZE}px`, height: `${BOARD_SIZE}px`,
            display: 'grid', gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
            border: `8px solid #2d3436`, backgroundColor: '#fff',
            position: 'relative', 
            boxShadow: '0 0 40px rgba(0, 0, 0, 0.5)'
        }}>
            
            {/* OVERLAYS */}
            {gameState === 'idle' && !spectatingTarget && (
                <div style={overlayStyle}>
                    <h1 style={{color: '#000', fontSize: '4rem', margin: '0 0 10px 0', textTransform: 'uppercase', lineHeight: '1'}}>NEON<br/>TILES</h1>
                    <p style={{color: '#555', marginBottom: '30px', fontWeight: 'bold', fontSize: '1.2rem'}}>CLICK BLACK TILES.<br/>FAST.<br/>DON'T MISS.</p>
                    <button onClick={initGame} style={buttonStyle}>START</button>
                </div>
            )}
            
            {gameState === 'gameover' && (
                <div style={{...overlayStyle, backgroundColor: 'rgba(255, 118, 117, 0.95)'}}>
                    <h2 style={{color: '#fff', fontSize: '5rem', margin: 0, textShadow: '4px 4px 0 #000'}}>GAME OVER</h2>
                    <p style={{color: '#fff', fontSize: '2.5rem', margin: '20px 0', fontWeight: 'bold'}}>SCORE: {score}</p>
                    {!spectatingTarget && (
                        <div>
                            <button onClick={initGame} style={{...buttonStyle, background: '#fff', color: '#ff7675'}}>RETRY</button>
                            <button onClick={() => navigate('/')} style={{...buttonStyle, background: 'transparent', border: '2px solid #fff', marginTop: '15px'}}>EXIT</button>
                        </div>
                    )}
                    {spectatingTarget && <div style={{color: '#fff', marginTop: '20px', fontSize: '1.2rem'}}>STREAM ENDED</div>}
                </div>
            )}

            {spectatingTarget && gameState === 'idle' && (
                 <div style={{...overlayStyle, backgroundColor: 'rgba(0,0,0,0.8)'}}>
                     <p style={{color: '#fff'}}>WAITING FOR SIGNAL...</p>
                 </div>
            )}

            {renderGrid()}

        </div>
        
        {/* INSTRUCTIONS FOOTER */}
        <div style={{ marginTop: '15px', color: '#fff', fontSize: '0.9rem', fontWeight: 'bold', textAlign: 'center', maxWidth: `${BOARD_SIZE}px` }}>
            {spectatingTarget 
                ? "LIVE FEED - SPECTATING" 
                : "Click black boxes, avoid white boxes. Every 40 successful clicks adds 10 seconds, and a score multiplier."
            }
        </div>
    </div>
  );
}

const overlayStyle = {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    zIndex: 10, textAlign: 'center'
};

const buttonStyle = {
    padding: '20px 50px', fontSize: '1.5rem', cursor: 'pointer',
    background: '#000', color: '#fff', border: 'none', borderRadius: '50px',
    fontWeight: '900', fontFamily: "'Courier New', Courier, monospace",
    boxShadow: '0 10px 0 #333',
    transform: 'translateY(0)',
    transition: 'transform 0.1s'
};

export default NeonTilesGame;