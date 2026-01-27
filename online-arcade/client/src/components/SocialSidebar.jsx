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

  // --- HELPER: Parse Game Activity ---
  const getActivityInfo = (gameString) => {
    if (!gameString) return { slug: '', target: null, isVsMe: false };

    // 1. Check if they are playing against ME
    const isVsMe = gameString.includes(` vs ${currentUser}`);

    // 2. Extract Slug (Smart Matching)
    let slug = '';
    const lower = gameString.toLowerCase();
    
    if (lower.startsWith('connect 4')) {
        slug = 'connect4'; 
    } else if (lower.startsWith('neon tiles')) { // <--- ADDED THIS FIX
        slug = 'neontiles';
    } else {
        // Default: take the first word (e.g. "Snake" -> "snake")
        slug = gameString.split(' ')[0].toLowerCase();
    }

    // 3. Extract Spectator Target
    let target = null;
    const match = gameString.match(/\(([^)]+)\)/); 
    if (match) target = match[1];

    return { slug, target, isVsMe };
  };

  // --- HELPER: Find MY Opponent ---
  const getMyOpponent = () => {
      const myProfile = onlineUsers.find(u => u.username === currentUser);
      if (!myProfile || !myProfile.game) return null;
      if (myProfile.game.includes(' vs ')) {
          return myProfile.game.split(' vs ')[1];
      }
      return null;
  };

  const myOpponent = getMyOpponent();

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
        const { slug, target, isVsMe } = getActivityInfo(u.game);

        const hideButton = 
            isMe ||                                             
            (currentSpectatingTarget === u.username) ||         
            isVsMe ||                                           
            (isWatching && currentSpectatingTarget === target) || 
            (isWatching && target === currentUser) ||           
            (isWatching && target === myOpponent);              

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