// client/src/pages/Leaderboard.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

function Leaderboard() {
  const { game } = useParams();
  const navigate = useNavigate();
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  // List of supported games for the tab navigation
  const games = [
    { id: 'snake', name: 'SNAKE', icon: '🐍' },
    { id: 'tetris', name: 'TETRIS', icon: '🧱' },
    { id: 'breakout', name: 'BREAKOUT', icon: '🎾' },
    { id: 'neontiles', name: 'NEON TILES', icon: '🎹' } // <--- ADDED
  ];

  // If URL has no game or invalid game, default to Snake
  const currentGameId = games.find(g => g.id === game) ? game : 'snake';

  useEffect(() => {
    setLoading(true);
    axios.get(`/api/leaderboard/${currentGameId}`)
      .then(res => {
        setScores(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching leaderboard:", err);
        setLoading(false);
      });
  }, [currentGameId]);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: "'Courier New', Courier, monospace" }}>
      
      <h1 style={{ textAlign: 'center', fontSize: '3rem', margin: '40px 0', color: '#fff', textShadow: '0 0 10px #fff' }}>
        LEADERBOARD
      </h1>

      {/* GAME TABS */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '40px', flexWrap: 'wrap' }}>
        {games.map(g => {
          const isActive = g.id === currentGameId;
          return (
            <button
              key={g.id}
              onClick={() => navigate(`/leaderboard/${g.id}`)}
              style={{
                padding: '10px 20px',
                fontSize: '1rem',
                cursor: 'pointer',
                border: '2px solid',
                borderColor: isActive ? '#00d2d3' : '#444',
                backgroundColor: isActive ? 'rgba(0, 210, 211, 0.1)' : '#111',
                color: isActive ? '#00d2d3' : '#888',
                borderRadius: '5px',
                fontWeight: 'bold',
                transition: 'all 0.2s'
              }}
            >
              <span style={{ marginRight: '8px' }}>{g.icon}</span>
              {g.name}
            </button>
          );
        })}
      </div>

      {/* SCORES TABLE */}
      <div style={{ 
        backgroundColor: '#222', 
        borderRadius: '10px', 
        padding: '20px', 
        border: '1px solid #333',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
      }}>
        {loading ? (
            <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>LOADING DATA...</div>
        ) : scores.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>NO SCORES YET. BE THE FIRST!</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #444', color: '#888', fontSize: '0.9rem' }}>
                <th style={{ padding: '15px', textAlign: 'left', width: '10%' }}>RANK</th>
                <th style={{ padding: '15px', textAlign: 'left' }}>PLAYER</th>
                <th style={{ padding: '15px', textAlign: 'right' }}>SCORE</th>
                <th style={{ padding: '15px', textAlign: 'right' }}>DATE</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s, idx) => {
                let rankColor = '#fff';
                let rowBg = 'transparent';
                
                if (idx === 0) { rankColor = '#ffd700'; rowBg = 'rgba(255, 215, 0, 0.05)'; } // Gold
                else if (idx === 1) { rankColor = '#c0c0c0'; } // Silver
                else if (idx === 2) { rankColor = '#cd7f32'; } // Bronze

                return (
                  <tr key={s._id} style={{ borderBottom: '1px solid #333', backgroundColor: rowBg }}>
                    <td style={{ padding: '15px', color: rankColor, fontWeight: 'bold', fontSize: '1.2rem' }}>
                      #{idx + 1}
                    </td>
                    <td style={{ padding: '15px', fontWeight: 'bold' }}>
                      {s.username}
                      {idx === 0 && <span style={{marginLeft: '10px'}}>👑</span>}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'right', color: '#00d2d3', fontWeight: 'bold', fontSize: '1.1rem' }}>
                      {s.score.toLocaleString()}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'right', color: '#666', fontSize: '0.8rem' }}>
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: '30px' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}>
              ← Back to Arcade
          </button>
      </div>

    </div>
  );
}

export default Leaderboard;