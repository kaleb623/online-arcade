// client/src/components/CheckersGame.jsx
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';

const socket = io('http://localhost:5000');

// Initial Board Setup (0=Empty, 1=Red, 2=Black)
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

function CheckersGame() {
  const navigate = useNavigate();
  
  // States: 'menu', 'waiting_lobby', 'playing'
  const [gameState, setGameState] = useState('menu'); 
  const [roomCode, setRoomCode] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [myColor, setMyColor] = useState(null); 
  const [turn, setTurn] = useState('red'); 
  const [board, setBoard] = useState(INITIAL_BOARD);
  const [selectedPiece, setSelectedPiece] = useState(null);

  useEffect(() => {
    // 1. Room Created (You are Host)
    socket.on('room_created', (code) => {
        setRoomCode(code);
        setGameState('waiting_lobby');
    });

    // 2. Game Start (Both Players)
    socket.on('game_start', (data) => {
        setMyColor(data.color);
        setRoomCode(data.room);
        setGameState('playing');
        setBoard(INITIAL_BOARD);
        setTurn('red');
    });

    // 3. Opponent Move
    socket.on('opponent_move', (move) => {
        handleMoveLocally(move.from, move.to, false); 
    });

    // 4. Errors
    socket.on('error_joining', (msg) => {
        setErrorMsg(msg);
        setTimeout(() => setErrorMsg(''), 3000);
    });

    return () => {
        socket.off('room_created');
        socket.off('game_start');
        socket.off('opponent_move');
        socket.off('error_joining');
    };
  }, []);

  // --- ACTIONS ---
  const createGame = () => {
      socket.emit('create_room');
  };

  const joinGame = () => {
      if(joinInput.length > 0) {
          socket.emit('join_room', joinInput.toUpperCase());
      }
  };

  // --- GAME LOGIC ---
  const handleMoveLocally = (from, to, shouldEmit = true) => {
      setBoard(prev => {
          const newBoard = prev.map(row => [...row]);
          const piece = newBoard[from.r][from.c];
          newBoard[to.r][to.c] = piece;
          newBoard[from.r][from.c] = 0;
          if (Math.abs(to.r - from.r) === 2) {
              const midR = (from.r + to.r) / 2;
              const midC = (from.c + to.c) / 2;
              newBoard[midR][midC] = 0; 
          }
          return newBoard;
      });
      setTurn(prev => prev === 'red' ? 'black' : 'red');
      if (shouldEmit) {
          socket.emit('make_move', { room: roomCode, move: { from, to } });
      }
  };

  const handleSquareClick = (r, c) => {
      if (gameState !== 'playing') return;
      if (turn !== myColor) return; 

      const clickedContent = board[r][c];
      const isMyPiece = (myColor === 'red' && clickedContent === 1) || (myColor === 'black' && clickedContent === 2);

      if (isMyPiece) {
          setSelectedPiece({ r, c });
          return;
      }

      if (selectedPiece && clickedContent === 0) {
          const dr = Math.abs(r - selectedPiece.r);
          const dc = Math.abs(c - selectedPiece.c);
          if ((dr === 1 && dc === 1) || (dr === 2 && dc === 2)) {
              handleMoveLocally(selectedPiece, { r, c });
              setSelectedPiece(null);
          }
      }
  };

  // --- STYLES ---
  const containerStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '40px', fontFamily: "'Courier New', Courier, monospace", color: '#fff' };
  const buttonStyle = { padding: '15px 30px', fontSize: '1.2rem', cursor: 'pointer', background: '#0984e3', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', margin: '10px' };
  const inputStyle = { padding: '15px', fontSize: '1.2rem', borderRadius: '5px', border: 'none', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '5px' };

  return (
    <div style={containerStyle}>
        
        {/* --- HEADER --- */}
        <h1 style={{ fontSize: '3rem', margin: '0 0 20px 0', textShadow: '0 0 10px #e17055' }}>CHECKERS</h1>

        {/* --- MENU STATE --- */}
        {gameState === 'menu' && (
            <div style={{ backgroundColor: '#2d3436', padding: '40px', borderRadius: '15px', border: '4px solid #636e72', textAlign: 'center' }}>
                <h2 style={{ color: '#b2bec3' }}>MULTIPLAYER LOBBY</h2>
                
                <div style={{ margin: '30px 0' }}>
                    <button onClick={createGame} style={buttonStyle}>CREATE GAME</button>
                </div>
                
                <div style={{ borderTop: '2px solid #636e72', paddingTop: '20px' }}>
                    <p style={{ color: '#b2bec3' }}>OR JOIN FRIEND</p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <input 
                            value={joinInput} 
                            onChange={(e) => setJoinInput(e.target.value)} 
                            placeholder="CODE" 
                            style={inputStyle} 
                            maxLength={4}
                        />
                        <button onClick={joinGame} style={{ ...buttonStyle, margin: 0, background: '#00b894' }}>JOIN</button>
                    </div>
                    {errorMsg && <p style={{ color: '#ff7675', marginTop: '10px' }}>{errorMsg}</p>}
                </div>
            </div>
        )}

        {/* --- WAITING STATE --- */}
        {gameState === 'waiting_lobby' && (
            <div style={{ textAlign: 'center', animation: 'pulse 2s infinite' }}>
                <h2 style={{ color: '#ffeaa7' }}>WAITING FOR PLAYER 2</h2>
                <div style={{ fontSize: '4rem', fontWeight: '900', letterSpacing: '10px', border: '4px dashed #fff', padding: '20px', margin: '20px 0', display: 'inline-block' }}>
                    {roomCode}
                </div>
                <p>SHARE THIS CODE WITH YOUR FRIEND</p>
            </div>
        )}

        {/* --- PLAYING STATE --- */}
        {gameState === 'playing' && (
            <>
                <div style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', gap: '20px' }}>
                    <span>ROOM: <b>{roomCode}</b></span>
                    <span>YOU: <b style={{ color: myColor === 'red' ? '#ff7675' : '#b2bec3' }}>{myColor.toUpperCase()}</b></span>
                    <span>{turn === myColor ? <span style={{ color: '#55efc4' }}>🟢 YOUR TURN</span> : <span style={{ color: '#fab1a0' }}>🔴 THEIR TURN</span>}</span>
                </div>

                <div style={{ 
                    border: '10px solid #636e72', 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(8, 60px)', 
                    gridTemplateRows: 'repeat(8, 60px)',
                    boxShadow: '0 0 30px rgba(0,0,0,0.5)'
                }}>
                    {board.map((row, r) => (
                        row.map((cell, c) => {
                            const isDark = (r + c) % 2 === 1;
                            const isSelected = selectedPiece?.r === r && selectedPiece?.c === c;
                            return (
                                <div 
                                    key={`${r}-${c}`}
                                    onClick={() => handleSquareClick(r, c)}
                                    style={{
                                        width: '60px', height: '60px',
                                        backgroundColor: isDark ? '#2d3436' : '#dfe6e9',
                                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                                        cursor: (turn === myColor && isDark) ? 'pointer' : 'default',
                                        position: 'relative'
                                    }}
                                >
                                    {isSelected && <div style={{ position: 'absolute', width: '100%', height: '100%', border: '4px solid #00cec9', boxSizing: 'border-box' }} />}
                                    {cell === 1 && <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'radial-gradient(circleAt 10px 10px, #ff7675, #d63031)', boxShadow: '2px 2px 5px rgba(0,0,0,0.5)' }} />}
                                    {cell === 2 && <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'radial-gradient(circleAt 10px 10px, #636e72, #2d3436)', border: '2px solid #000', boxShadow: '2px 2px 5px rgba(0,0,0,0.5)' }} />}
                                </div>
                            );
                        })
                    ))}
                </div>
            </>
        )}

        <button onClick={() => navigate('/')} style={{ marginTop: '30px', background: 'none', border: 'none', color: '#b2bec3', cursor: 'pointer', fontSize: '1rem' }}>← EXIT TO LOBBY</button>
    </div>
  );
}

export default CheckersGame;