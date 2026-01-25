// client/src/pages/Leaderboard.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const AVAILABLE_GAMES = [
  { id: 'snake', label: '🐍 SNAKE' },
  { id: 'breakout', label: '🧱 BREAKOUT' }
];

function Leaderboard() {
  const [selectedGame, setSelectedGame] = useState('snake');
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Re-fetch whenever the selected game changes
  useEffect(() => {
    setLoading(true);
    // Use relative path so it works with the unified proxy
    axios.get(`/api/leaderboard/${selectedGame}`)
      .then(res => {
        setScores(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Leaderboard error:", err);
        setLoading(false);
      });
  }, [selectedGame]);

  return (
    <div style={{ 
      textAlign: 'center', 
      marginTop: '50px', 
      fontFamily: "'Courier New', Courier, monospace",
      color: '#fff'
    }}>
      
      <h1 style={{ 
        fontSize: '3rem', 
        textShadow: '0 0 10px #0984e3',
        marginBottom: '10px'
      }}>
        HIGH SCORES
      </h1>
      
      <Link to="/" style={{ color: '#00cec9', textDecoration: 'none', fontSize: '1.2rem' }}>
        ← BACK TO ARCADE
      </Link>

      {/* --- GAME SELECTOR TABS --- */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '40px', marginBottom: '30px' }}>
        {AVAILABLE_GAMES.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelectedGame(g.id)}
            style={{
              padding: '10px 20px',
              fontSize: '1.2rem',
              cursor: 'pointer',
              border: 'none',
              borderRadius: '5px',
              fontWeight: 'bold',
              fontFamily: 'inherit',
              // Active vs Inactive Styles
              backgroundColor: selectedGame === g.id ? '#0984e3' : '#2d3436',
              color: selectedGame === g.id ? '#fff' : '#b2bec3',
              boxShadow: selectedGame === g.id ? '0 0 15px #0984e3' : 'none',
              transform: selectedGame === g.id ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 0.2s ease'
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* --- SCORE LIST --- */}
      <div style={{ 
        backgroundColor: '#2d3436', 
        maxWidth: '500px', 
        margin: '0 auto', 
        padding: '20px', 
        borderRadius: '15px',
        border: '4px solid #636e72',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
      }}>
        {loading ? (
          <p style={{ color: '#b2bec3' }}>LOADING DATA...</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {scores.length === 0 ? (
              <p style={{ color: '#b2bec3', fontStyle: 'italic' }}>NO SCORES YET. BE THE FIRST!</p>
            ) : (
              scores.map((entry, index) => (
                <li key={index} style={{ 
                  background: index === 0 ? 'rgba(255, 215, 0, 0.2)' : 'rgba(0,0,0,0.2)', // Gold tint for #1
                  border: index === 0 ? '1px solid #ffd700' : 'none',
                  margin: '10px 0', 
                  padding: '15px', 
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '1.1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ 
                      color: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#636e72',
                      fontWeight: 'bold',
                      fontSize: '1.5rem'
                    }}>
                      #{index + 1}
                    </span>
                    <span style={{ color: '#fff' }}>{entry.username}</span>
                  </div>
                  <span style={{ color: '#00cec9', fontWeight: 'bold' }}>{entry.score}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

    </div>
  );
}

export default Leaderboard;