// client/src/pages/Home.jsx
import { Link } from 'react-router-dom';

const Home = () => {
  const username = localStorage.getItem('user');

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: "'Courier New', Courier, monospace" }}>
      
      <h1 style={{ 
        fontSize: '4rem', 
        color: '#fff', 
        textShadow: '0 0 20px #0984e3',
        marginBottom: '10px'
      }}>
        THE ARCADE
      </h1>
      <p style={{ color: '#b2bec3', fontSize: '1.2rem', marginBottom: '50px' }}>
        WELCOME BACK, {username ? username.toUpperCase() : 'GUEST'}
      </p>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '40px', 
        flexWrap: 'wrap' 
      }}>
        
        {/* --- SNAKE CARD --- */}
        <Link to="/game/snake" style={{ textDecoration: 'none' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: '4rem' }}>🐍</div>
            <h2 style={{ color: '#2ecc71', margin: '10px 0' }}>SNAKE</h2>
            <p style={{ color: '#fff' }}>The Classic. Eat the food.</p>
            <div style={playButtonStyle}>PLAY NOW</div>
          </div>
        </Link>

        {/* --- BREAKOUT CARD --- */}
        <Link to="/game/breakout" style={{ textDecoration: 'none' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: '4rem' }}>🧱</div>
            <h2 style={{ color: '#ff7675', margin: '10px 0' }}>BREAKOUT</h2>
            <p style={{ color: '#fff' }}>Smash bricks. Don't miss.</p>
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