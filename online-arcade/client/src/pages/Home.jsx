// client/src/pages/Home.jsx
import { Link } from 'react-router-dom';

const Home = () => {
  const username = localStorage.getItem('user');

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: "'Courier New', Courier, monospace" }}>
      
      {/* HEADER */}
      <div style={{ 
        fontSize: '8rem', 
        fontWeight: '900',
        fontFamily: 'sans-serif', 
        letterSpacing: '-10px',   
        marginBottom: '10px',
        textShadow: '0 0 30px rgba(0, 210, 211, 0.5)' 
      }}>
        <span style={{ color: '#4cd137' }}>G</span>
        <span style={{ color: '#00d2d3' }}>G</span>
      </div>
      <p style={{ color: '#b2bec3', fontSize: '1.2rem', marginBottom: '50px' }}>
        Hi, {username ? username : 'GUEST'}
      </p>

      {/* --- SINGLE PLAYER SECTION --- */}
      <h2 style={{ color: '#b2bec3', borderBottom: '2px solid #636e72', width: '80%', margin: '0 auto 30px auto', paddingBottom: '10px', letterSpacing: '2px' }}>
        SINGLE PLAYER
      </h2>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap', marginBottom: '60px' }}>
        
        {/* SNAKE */}
        <Link to="/game/snake" style={{ textDecoration: 'none' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: '4rem' }}>🐍</div>
            <h2 style={{ color: '#2ecc71', margin: '10px 0' }}>SNAKE</h2>
            <p style={{ color: '#fff' }}>Snake but better</p>
            <div style={playButtonStyle}>PLAY NOW</div>
          </div>
        </Link>

        {/* BREAKOUT */}
        <Link to="/game/breakout" style={{ textDecoration: 'none' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: '4rem' }}>🧱</div>
            <h2 style={{ color: '#ff7675', margin: '10px 0' }}>BREAKOUT</h2>
            <p style={{ color: '#fff' }}>Bricked up</p>
            <div style={playButtonStyle}>PLAY NOW</div>
          </div>
        </Link>

        {/* TETRIS */}
        <Link to="/game/tetris" style={{ textDecoration: 'none' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: '4rem' }}>🧩</div>
            <h2 style={{ color: '#a000f0', margin: '10px 0' }}>TETRIS</h2>
            <p style={{ color: '#fff' }}>Stack 'em up.</p>
            <div style={playButtonStyle}>PLAY NOW</div>
          </div>
        </Link>
      </div>

      {/* --- MULTIPLAYER SECTION --- */}
      <h2 style={{ color: '#b2bec3', borderBottom: '2px solid #636e72', width: '80%', margin: '0 auto 30px auto', paddingBottom: '10px', letterSpacing: '2px' }}>
        MULTIPLAYER
      </h2>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap', marginBottom: '50px' }}>
        
        {/* CHECKERS */}
        <Link to="/game/checkers" style={{ textDecoration: 'none' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: '4rem' }}>🔴</div>
            <h2 style={{ color: '#e17055', margin: '10px 0' }}>CHECKERS</h2>
            <p style={{ color: '#fff' }}>1v1 Strategy</p>
            <div style={playButtonStyle}>PLAY NOW</div>
          </div>
        </Link>

      </div>
    </div>
  );
};

// --- STYLES ---
const cardStyle = {
  backgroundColor: '#2d3436',
  border: '4px solid #636e72',
  borderRadius: '15px',
  padding: '30px',
  width: '250px',
  cursor: 'pointer',
  transition: 'transform 0.2s, box-shadow 0.2s',
  boxShadow: '0 10px 20px rgba(0,0,0,0.5)'
};

const playButtonStyle = {
  marginTop: '20px',
  backgroundColor: '#0984e3',
  color: 'white',
  padding: '10px',
  borderRadius: '5px',
  fontWeight: 'bold',
  boxShadow: '0 4px 0 #0056b3'
};

export default Home;