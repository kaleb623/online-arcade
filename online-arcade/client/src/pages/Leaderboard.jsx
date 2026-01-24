// client/src/pages/Leaderboard.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

function Leaderboard() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch snake scores automatically when page loads
    axios.get('http://localhost:5000/api/leaderboard/snake')
      .then(res => {
        setScores(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>🏆 High Scores (Snake) 🏆</h2>
      <Link to="/">Back to Home</Link>

      {loading ? (
        <p>Loading scores...</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: '20px' }}>
          {scores.length === 0 ? <p>No scores yet!</p> : null}
          
          {scores.map((entry, index) => (
            <li key={index} style={{ 
              background: '#eee', 
              margin: '10px auto', 
              padding: '10px', 
              width: '300px',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>#{index + 1} <b>{entry.username}</b></span>
              <span>{entry.score} pts</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Leaderboard;