// client/src/pages/Leaderboard.jsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

function Leaderboard() {
  const { game } = useParams();
  const [scores, setScores] = useState([]);

  useEffect(() => {
    axios.get(`/api/leaderboard/${game}`)
      .then(res => setScores(res.data))
      .catch(err => console.log(err));
  }, [game]);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ letterSpacing: '4px', textAlign: 'center', marginBottom: '40px' }}>GLOBAL RANKINGS</h1>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <Link to="/leaderboard/snake" style={tabStyle(game === 'snake')}>SNAKE</Link>
        <Link to="/leaderboard/tetris" style={tabStyle(game === 'tetris')}>TETRIS</Link>
        <Link to="/leaderboard/breakout" style={tabStyle(game === 'breakout')}>BREAKOUT</Link>
      </div>

      <div style={{ 
        background: '#111', 
        border: '1px solid #333', 
        borderRadius: '12px', 
        padding: '20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ color: '#555', borderBottom: '1px solid #333' }}>
              <th style={{ padding: '15px' }}>#</th>
              <th style={{ padding: '15px' }}>PLAYER</th>
              <th style={{ padding: '15px' }}>SCORE</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s, i) => (
              <tr key={s._id} style={{ borderBottom: '1px solid #222' }}>
                <td style={{ padding: '15px', color: '#b2bec3' }}>{i + 1}</td>
                <td style={{ padding: '15px', fontWeight: 'bold' }}>{s.username}</td>
                <td style={{ padding: '15px', color: '#4cd137' }}>{s.score.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const tabStyle = (active) => ({
  padding: '10px 20px',
  background: active ? '#fff' : '#111',
  color: active ? '#000' : '#b2bec3',
  textDecoration: 'none',
  borderRadius: '6px',
  fontWeight: 'bold',
  fontSize: '0.8rem',
  border: '1px solid #333'
});

export default Leaderboard;