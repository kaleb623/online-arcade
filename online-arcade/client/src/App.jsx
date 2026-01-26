// client/src/App.jsx
import { useState } from 'react'; // Added useState
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import Login from './pages/Login';
import SnakeGame from './components/SnakeGame';
import BreakoutGame from './components/BreakoutGame'; 
import TetrisGame from './components/TetrisGame';
import CheckersGame from './components/CheckersGame';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  // Use state so React "watches" for changes
  const [user, setUser] = useState(localStorage.getItem('user'));

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null); // Instantly updates the navbar
    window.location.reload(); 
  };

  return (
    <Router>
      <nav style={{ 
        padding: '15px 30px', background: '#111', borderBottom: '1px solid #333', 
        color: 'white', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', fontFamily: 'Verdana, sans-serif', fontSize: '0.9rem'
      }}>
        <div>
          <Link to="/" style={{ color: 'white', marginRight: '20px', textDecoration: 'none', fontWeight: 'bold' }}>🏠 HOME</Link>
          <Link to="/leaderboard" style={{ color: '#b2bec3', textDecoration: 'none' }}>🏆 LEADERBOARD</Link>
        </div>
        <div>
          {/* This now reflects state changes instantly! */}
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

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        
        {/* Pass setUser to the Login page as a prop */}
        <Route path="/login" element={<Login onLoginSuccess={setUser} />} />
        
        <Route path="/game/snake" element={<ProtectedRoute><SnakeGame /></ProtectedRoute>} />
        <Route path="/game/breakout" element={<ProtectedRoute><BreakoutGame /></ProtectedRoute>} />
        <Route path="/game/tetris" element={<ProtectedRoute><TetrisGame /></ProtectedRoute>} />
        <Route path="/game/checkers" element={<CheckersGame />} />
      </Routes>
    </Router>
  );
}

export default App;