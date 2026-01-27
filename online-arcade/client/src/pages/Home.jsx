// client/src/pages/Home.jsx
import { Link } from 'react-router-dom';

function Home() {
  const gameCategories = [
    {
      title: "SINGLE PLAYER CLASSICS",
      games: [
        { path: "/game/snake", name: "SNAKE", icon: "🐍", desc: "High speed, high stakes." },
        { path: "/game/tetris", name: "TETRIS", icon: "🧱", desc: "Classical stacker." },
        { path: "/game/breakout", name: "BREAKOUT", icon: "🎾", desc: "Destroy the wall." },
      ]
    },
    {
      title: "MULTIPLAYER BATTLES",
      games: [
        { path: "/game/checkers", name: "CHECKERS", icon: "🏁", desc: "Strategy & Skill." },
      ]
    }
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`
        .gg-card {
          position: relative;
          text-decoration: none;
          color: #fff;
          display: flex;
          flex-direction: column;
          /* CENTER CONTENT ADDITIONS */
          align-items: center; 
          text-align: center;
          /* ------------------------ */
          padding: 35px;
          border-radius: 16px;
          transition: transform 0.2s;
          
          /* THE PERMANENT GRADIENT BORDER TRICK */
          background: 
            linear-gradient(#252525, #252525) padding-box,
            linear-gradient(90deg, #4cd137, #00d2d3) border-box;
            
          /* Make the border transparent so the gradient shines through */
          border: 2px solid transparent;
        }

        .gg-card:hover {
          transform: translateY(-5px);
        }
      `}</style>

      {gameCategories.map((cat, idx) => (
        <div key={idx} style={{ marginBottom: '60px' }}>
          <h2 style={{ letterSpacing: '4px', color: '#ffffff', fontSize: '1.6rem', textAlign: 'center', marginBottom: '25px', textTransform: 'uppercase' }}>{cat.title}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px' }}>
            {cat.games.map((game) => (
              <Link key={game.name} to={game.path} className="gg-card">
                <div style={{ fontSize: '3.5rem', marginBottom: '15px' }}>{game.icon}</div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.6rem', color: '#fff' }}>{game.name}</h3>
                <p style={{ margin: 0, color: '#999', fontSize: '0.9rem', lineHeight: '1.4' }}>{game.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Home;