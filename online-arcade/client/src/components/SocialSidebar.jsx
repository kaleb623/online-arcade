// client/src/components/SocialSidebar.jsx
import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { useNavigate, useSearchParams } from 'react-router-dom';

const SocialSidebar = () => {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Who am I?
  const currentUser = localStorage.getItem('user');
  // Who am I currently watching?
  const currentSpectatingTarget = searchParams.get('spectate');

  useEffect(() => {
    socket.on('initial_user_list', (users) => setOnlineUsers(users));

    socket.on('user_online', (data) => {
      setOnlineUsers(prev => {
        if (prev.find(u => u.username === data.username)) return prev;
        return [...prev, { ...data, status: 'online', game: null }];
      });
    });

    socket.on('user_offline', (username) => {
      setOnlineUsers(prev => prev.filter(u => u.username !== username));
    });

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

  const parseActivity = (gameString, status) => {
    if (!gameString) return { slug: '', target: null };
    const slug = gameString.split(' ')[0].toLowerCase();
    let target = null;
    if (status === 'watching') {
      const match = gameString.match(/\(([^)]+)\)/); 
      if (match) target = match[1];
    }
    return { slug, target };
  };

  return (
    <div style={{ 
      width: '100%', height: '100%',
      padding: '20px', 
      overflowY: 'auto',
      fontFamily: 'Verdana, sans-serif',
      boxSizing: 'border-box'
    }}>
      <h3 style={{ fontSize: '0.7rem', color: '#555', letterSpacing: '2px', marginBottom: '20px', textTransform: 'uppercase' }}>
        Online Players ({onlineUsers.length})
      </h3>
      
      {onlineUsers.map(u => {
        const isMe = u.username === currentUser;
        const isWatching = u.status === 'watching';
        const { slug, target } = parseActivity(u.game, u.status);

        // LOGIC: Hide button if:
        // 1. It is ME (Cannot watch myself)
        // 2. I am already spectating THIS user
        // 3. I am already spectating the person THEY are watching (loop prevention)
        const hideButton = isMe || 
                           (currentSpectatingTarget === u.username) || 
                           (isWatching && currentSpectatingTarget === target);

        return (
          <div key={u.username} style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '10px', height: '10px', borderRadius: '50%', 
              backgroundColor: u.game ? '#4cd137' : '#7f8c8d', 
              boxShadow: u.game ? '0 0 8px #4cd137' : 'none' 
            }} />
            
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#fff' }}>
                {u.username} {isMe && <span style={{fontSize: '0.7rem', color: '#555'}}>(YOU)</span>}
              </div>
              
              <div style={{ fontSize: '0.75rem', marginTop: '2px', color: isWatching ? '#fff' : '#777' }}>
                {u.game ? (
                  <>
                    <span style={{ marginRight: '5px' }}>
                      {isWatching ? '👁️' : '🎮'}
                    </span>
                    <span style={{ color: isWatching ? '#fff' : '#00d2d3' }}>
                      {u.game.toUpperCase()}
                    </span>
                  </>
                ) : (
                  'In Menu'
                )}

                {u.game && !hideButton && (
                  <button 
                    onClick={() => {
                      const finalTarget = isWatching ? target : u.username;
                      navigate(`/game/${slug}?spectate=${finalTarget}`);
                    }}
                    style={{ 
                      marginLeft: '10px', background: 'none', border: 'none', 
                      color: isWatching ? '#fff' : '#00d2d3',
                      cursor: 'pointer', textDecoration: 'underline', 
                      padding: 0, fontSize: '0.7rem', fontWeight: 'bold'
                    }}
                  >
                    {isWatching ? 'JOIN' : 'WATCH'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {onlineUsers.length === 0 && (
        <div style={{ color: '#444', fontSize: '0.8rem', fontStyle: 'italic' }}>No one else is online...</div>
      )}
    </div>
  );
};

export default SocialSidebar;