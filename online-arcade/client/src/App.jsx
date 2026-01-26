// client/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import Login from './pages/Login';
import SnakeGame from './components/SnakeGame';
import BreakoutGame from './components/BreakoutGame'; 
import TetrisGame from './components/TetrisGame';
import CheckersGame from './components/CheckersGame'; // <--- Added Import
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const user = localStorage.getItem('user');

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.reload();
  };

  return (
    <Router>
      <nav style={{ 
        padding: '15px 30px', 
        background: '#111',   
        borderBottom: '1px solid #333', 
        color: 'white', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center', 
        fontFamily: 'Verdana, sans-serif',
        fontSize: '0.9rem',
        letterSpacing: '0.5px'
      }}>
        <div>
          <Link to="/" style={{ color: 'white', marginRight: '20px', textDecoration: 'none', fontWeight: 'bold' }}>🏠 HOME</Link>
          <Link to="/leaderboard" style={{ color: '#b2bec3', textDecoration: 'none', transition: 'color 0.2s' }}>🏆 LEADERBOARD</Link>
        </div>
        <div>
          {user ? (
            <span style={{ color: '#dfe6e9' }}>
              Welcome, <b style={{ color: '#fff' }}>{user}</b> 
              <button 
                onClick={handleLogout} 
                style={{
                  marginLeft: '15px',
                  padding: '5px 12px',
                  background: '#d63031',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  fontFamily: 'Verdana, sans-serif', 
                  fontWeight: 'bold',
                  fontSize: '0.8rem'
                }}
              >
                LOGOUT
              </button>
            </span>
          ) : (
            <Link to="/login" style={{ color: '#ffeaa7', textDecoration: 'none', fontWeight: 'bold' }}>LOGIN / REGISTER</Link>
          )}
        </div>
      </nav>

      <Routes>
        {/* --- MAIN PAGES --- */}
        <Route path="/" element={<Home />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/login" element={<Login />} />
        
        {/* --- GAME ROUTES (GROUPED) --- */}
        <Route 
          path="/game/snake" 
          element={
            <ProtectedRoute>
              <SnakeGame />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/game/breakout" 
          element={
            <ProtectedRoute>
              <BreakoutGame />
            </ProtectedRoute>
          }
        />

        <Route 
          path="/game/tetris" 
          element={
            <ProtectedRoute>
              <TetrisGame />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/game/checkers" 
          element={
            <ProtectedRoute>
              <CheckersGame />
            </ProtectedRoute>
          } 
        />

      </Routes>
    </Router>
  );
}

export default App;