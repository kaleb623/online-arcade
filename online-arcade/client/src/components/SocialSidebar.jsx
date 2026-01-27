// client/src/components/SocialSidebar.jsx
import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { useNavigate } from 'react-router-dom';

const SocialSidebar = () => {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Receive the full list from the server on startup
    socket.on('initial_user_list', (users) => {
      setOnlineUsers(users);
    });

    // 2. Handle new users joining later
    socket.on('user_online', (data) => {
      setOnlineUsers(prev => {
        if (prev.find(u => u.username === data.username)) return prev;
        return [...prev, { ...data, status: 'online', game: null }];
      });
    });

    // 3. Remove users who leave
    socket.on('user_offline', (username) => {
      setOnlineUsers(prev => prev.filter(u => u.username !== username));
    });

    // 4. Update activity icons (e.g., "Playing Checkers")
    socket.on('status_change', (data) => {
      setOnlineUsers(prev => prev.map(u => 
        u.username === data.username ? { ...u, status: data.status, game: data.game } : u
      ));
    });

    return () => {
      socket.off('initial_user_list');
      socket.off('user_online');
      socket.off('user_offline');
      socket.off('status_change');
    };
  }, []);

  return (
    <div style={{ 
      width: '250px', backgroundColor: '#111', borderLeft: '1px solid #333', 
      padding: '20px', height: 'calc(100vh - 60px)', overflowY: 'auto',
      fontFamily: 'Verdana, sans-serif'
    }}>
      <h3 style={{ fontSize: '0.7rem', color: '#555', letterSpacing: '2px', marginBottom: '20px', textTransform: 'uppercase' }}>
        Online Players ({onlineUsers.length})
      </h3>
      
      {onlineUsers.map(u => (
        <div key={u.username} style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Status Indicator Dot */}
          <div style={{ 
            width: '10px', height: '10px', borderRadius: '50%', 
            backgroundColor: '#4cd137', 
            boxShadow: '0 0 8px #4cd137' 
          }} />
          
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#fff' }}>{u.username}</div>
            <div style={{ fontSize: '0.75rem', color: u.game ? '#00d2d3' : '#777', marginTop: '2px' }}>
              {u.game ? `🎮 ${u.game.toUpperCase()}` : 'In Menu'}
              
              {u.game && (
                <button 
                  onClick={() => navigate(`/game/${u.game}?spectate=${u.username}`)}
                  style={{ 
                    marginLeft: '10px', background: 'none', border: 'none', 
                    color: '#00d2d3', cursor: 'pointer', textDecoration: 'underline', 
                    padding: 0, fontSize: '0.7rem' 
                  }}
                >
                  WATCH
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {onlineUsers.length === 0 && (
        <div style={{ color: '#444', fontSize: '0.8rem', fontStyle: 'italic' }}>No one else is online...</div>
      )}
    </div>
  );
};

export default SocialSidebar;