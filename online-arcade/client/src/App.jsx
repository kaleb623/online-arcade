// client/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import Login from './pages/Login';
import SnakeGame from './components/SnakeGame';
import BreakoutGame from './components/BreakoutGame'; // <--- 1. IMPORT ADDED
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
        padding: '15px', 
        background: '#222', 
        color: 'white', 
        display: 'flex', 
        justifyContent: 'space-between',
      }}>
        <div>
          <Link to="/" style={{ color: 'white', marginRight: '15px', textDecoration: 'none' }}>🏠 Home</Link>
          <Link to="/leaderboard" style={{ color: 'white', textDecoration: 'none' }}>🏆 Leaderboard</Link>
        </div>
        <div>
          {user ? (
            <span>Welcome, <b>{user}</b>! <button onClick={handleLogout} style={{marginLeft: '10px'}}>Logout</button></span>
          ) : (
            <Link to="/login" style={{ color: 'yellow' }}>Login / Register</Link>
          )}
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/login" element={<Login />} />
        
        {/* SNAKE ROUTE */}
        <Route 
          path="/game/snake" 
          element={
            <ProtectedRoute>
              <SnakeGame />
            </ProtectedRoute>
          } 
        />

        {/* --- 2. BREAKOUT ROUTE ADDED --- */}
        <Route 
          path="/game/breakout" 
          element={
            <ProtectedRoute>
              <BreakoutGame />
            </ProtectedRoute>
          } 
        />

      </Routes>
    </Router>
  );
}

export default App;