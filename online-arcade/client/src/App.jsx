// client/src/App.jsx
import { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { socket } from './socket'; 
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import Login from './pages/Login';
import SnakeGame from './components/SnakeGame';
import BreakoutGame from './components/BreakoutGame'; 
import TetrisGame from './components/TetrisGame';
import CheckersGame from './components/CheckersGame';
import ProtectedRoute from './components/ProtectedRoute';
import SocialSidebar from './components/SocialSidebar';

function App() {
  const [user, setUser] = useState(localStorage.getItem('user'));
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user !== "Anonymous") {
      socket.emit('identify', user); 
    }
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
    window.location.reload(); 
  };

  return (
    <div style={{ 
      backgroundColor: '#181818', // New Charcoal Body Color
      color: '#fff', 
      height: '100vh', 
      width: '100vw',
      display: 'flex', 
      flexDirection: 'column', 
      fontFamily: "'Courier New', Courier, monospace",
      overflow: 'hidden' 
    }}>
      
      {/* NAVBAR */}
      <nav style={{ 
        height: '80px',
        padding: '0 30px', 
        background: '#111', 
        borderBottom: '1px solid #333', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center', 
        flexShrink: 0,
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
          <Link to="/" style={{ color: 'white', textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
            <span>🏠</span> HOME
          </Link>
          <Link to="/leaderboard/snake" style={{ color: '#b2bec3', textDecoration: 'none', fontSize: '0.9rem' }}>🏆 LEADERBOARD</Link>
        </div>

        <div style={{ 
          position: 'absolute', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          display: 'flex', 
          fontWeight: '900', 
          fontSize: '3rem', 
          letterSpacing: '-4px' 
        }}>
           <span style={{ color: '#4cd137', textShadow: '0 0 15px #4cd137' }}>G</span>
           <span style={{ color: '#00d2d3', textShadow: '0 0 15px #00d2d3' }}>G</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flex: 1 }}>
          {user && user !== "Anonymous" ? (
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: '#dfe6e9', marginRight: '15px' }}>Welcome, <b>{user}</b></span>
              <button onClick={handleLogout} style={{ padding: '5px 12px', background: '#d63031', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                LOGOUT
              </button>
            </div>
          ) : (
            <Link to="/login" style={{ color: '#ffeaa7', textDecoration: 'none', fontWeight: 'bold' }}>LOGIN / REGISTER</Link>
          )}
        </div>
      </nav>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <main style={{ 
          flex: 1, 
          height: '100%',
          overflowY: 'auto', 
          padding: '40px', // More breathing room
          boxSizing: 'border-box',
          position: 'relative'
        }}>
          {/* Internal Scrollbar Styling */}
          <style>{`
            main::-webkit-scrollbar { width: 10px; }
            main::-webkit-scrollbar-track { background: #181818; }
            main::-webkit-scrollbar-thumb { background: #333; border-radius: 5px; border: 2px solid #181818; }
            main::-webkit-scrollbar-thumb:hover { background: #444; }
          `}</style>

          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/leaderboard/:game" element={<Leaderboard />} />
            <Route path="/login" element={<Login onLoginSuccess={setUser} />} />
            <Route path="/game/snake" element={<ProtectedRoute><SnakeGame /></ProtectedRoute>} />
            <Route path="/game/breakout" element={<ProtectedRoute><BreakoutGame /></ProtectedRoute>} />
            <Route path="/game/tetris" element={<ProtectedRoute><TetrisGame /></ProtectedRoute>} />
            <Route path="/game/checkers" element={<CheckersGame />} />
          </Routes>
        </main>

        {user && user !== "Anonymous" && (
          <aside style={{ 
            width: '260px', 
            height: '100%', 
            borderLeft: '1px solid #333', 
            flexShrink: 0,
            background: '#121212' // Slightly different from body
          }}>
             <SocialSidebar />
          </aside>
        )}
      </div>
    </div>
  );
}

export default App;