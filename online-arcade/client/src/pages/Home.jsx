// client/src/pages/Home.jsx
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>👾 Welcome to the Arcade 👾</h1>
      <p>Play games, earn tickets, and compete for the high score!</p>
      
      <div style={{ marginTop: '30px' }}>
        <Link to="/game/snake">
          <button style={{ padding: '10px 20px', fontSize: '1.2rem', cursor: 'pointer' }}>
            Play Snake 🐍
          </button>
        </Link>
      </div>

      <div style={{ marginTop: '20px' }}>
        <Link to="/leaderboard">View Leaderboards 🏆</Link>
      </div>
    </div>
  );
}

export default Home;