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

  // Unified Identity Logic
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
      backgroundColor: '#000', 
      color: '#fff', 
      height: '100vh', // Force container to fill the screen
      display: 'flex', 
      flexDirection: 'column', 
      fontFamily: 'Courier New',
      overflow: 'hidden' // Prevent body-level scrollbars
    }}>
      {/* Navigation Bar */}
      <nav style={{ 
        height: '60px', // Fixed height for consistent layout calculations
        padding: '0 30px', 
        background: '#111', 
        borderBottom: '1px solid #333', 
        color: 'white', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center', 
        fontFamily: 'Verdana, sans-serif', 
        fontSize: '0.9rem',
        flexShrink: 0 // Prevent nav from shrinking
      }}>
        <div>
          <Link to="/" style={{ color: 'white', marginRight: '20px', textDecoration: 'none', fontWeight: 'bold' }}>🏠 HOME</Link>
          <Link to="/leaderboard/snake" style={{ color: '#b2bec3', textDecoration: 'none' }}>🏆 LEADERBOARD</Link>
        </div>
        <div>
          {user && user !== "Anonymous" ? (
            <span style={{ color: '#dfe6e9' }}>
              Welcome, <b style={{ color: '#fff' }}>{user}</b> 
              <button onClick={handleLogout} style={{ marginLeft: '15px', padding: '5px 12px', background: '#d63031', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                LOGOUT
              </button>
            </span>
          ) : (
            <Link to="/login" style={{ color: '#ffeaa7', textDecoration: 'none', fontWeight: 'bold' }}>LOGIN / REGISTER</Link>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <div style={{ 
        display: 'flex', 
        flex: 1, // Fill remaining vertical space
        overflow: 'hidden' 
      }}>
        {/* Game/Page Container */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', // Allow game area to scroll independently
          padding: '20px' 
        }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/leaderboard/:game" element={<Leaderboard />} />
            <Route path="/login" element={<Login onLoginSuccess={setUser} />} />
            
            <Route path="/game/snake" element={<ProtectedRoute><SnakeGame /></ProtectedRoute>} />
            <Route path="/game/breakout" element={<ProtectedRoute><BreakoutGame /></ProtectedRoute>} />
            <Route path="/game/tetris" element={<ProtectedRoute><TetrisGame /></ProtectedRoute>} />
            <Route path="/game/checkers" element={<CheckersGame />} />
          </Routes>
        </div>

        {/* Sidebar */}
        {user && user !== "Anonymous" && (
          <div style={{ height: '100%', display: 'flex' }}>
            <SocialSidebar />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;