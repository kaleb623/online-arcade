// client/src/pages/Login.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';

function Login({ onLoginSuccess }) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // 1. Determine initial mode and message from URL parameters
    const modeParam = searchParams.get('mode');
    const msgParam = searchParams.get('msg');
    
    const [isRegistering, setIsRegistering] = useState(modeParam === 'register');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // 2. Safety Check: If already logged in with a pending game, just go there
    useEffect(() => {
        const user = localStorage.getItem('user');
        const pendingRoom = sessionStorage.getItem('pendingRoom');
        if (user && user !== "Anonymous" && pendingRoom) {
            sessionStorage.removeItem('pendingRoom');
            navigate(`/game/checkers?room=${pendingRoom}`);
        }
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const endpoint = isRegistering ? '/api/register' : '/api/login';
        
        try {
            const res = await axios.post(endpoint, { username, password });
            
            if (res.data.status === 'ok') {
                // Save to local storage for persistence
                localStorage.setItem('user', res.data.user);
                
                // --- INSTANT NAVBAR UPDATE ---
                // We call the function passed from App.jsx to update the state
                if (onLoginSuccess) {
                    onLoginSuccess(res.data.user);
                }
                
                // Check if user should be redirected back to a checkers game
                const pendingRoom = sessionStorage.getItem('pendingRoom');
                if (pendingRoom) {
                    sessionStorage.removeItem('pendingRoom');
                    navigate(`/game/checkers?room=${pendingRoom}`);
                } else {
                    navigate('/');
                }
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Authentication failed. Please try again.');
        }
    };

    // --- STYLING ---
    const containerStyle = {
        backgroundColor: '#000',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: "'Courier New', Courier, monospace"
    };

    const brandingStyle = {
        fontSize: '4.5rem',
        fontWeight: '900',
        marginBottom: '20px',
        letterSpacing: '-5px'
    };

    const messageBoxStyle = {
        border: '4px solid rgb(76, 209, 55)',
        color: 'rgb(76, 209, 55)',
        padding: '20px',
        marginBottom: '30px',
        textAlign: 'center',
        backgroundColor: 'rgba(76, 209, 55, 0.15)',
        width: '380px',
        fontWeight: '900',
        boxShadow: '0 0 20px rgba(76, 209, 55, 0.3)',
        textTransform: 'uppercase'
    };

    const formStyle = {
        padding: '40px',
        border: '4px solid #fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '25px',
        width: '380px',
        backgroundColor: '#000'
    };

    const inputGroupStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
    };

    const inputStyle = {
        padding: '12px',
        background: '#000',
        border: '2px solid #fff',
        color: '#fff',
        outline: 'none',
        fontFamily: 'inherit'
    };

    const submitBtnStyle = {
        padding: '15px',
        background: '#fff',
        color: '#000',
        fontWeight: '900',
        cursor: 'pointer',
        border: 'none',
        fontSize: '1.1rem',
        textTransform: 'uppercase'
    };

    return (
        <div style={containerStyle}>
            {/* GG BRANDING */}
            <div style={brandingStyle}>
                <span style={{ color: 'rgb(76, 209, 55)', textShadow: '0 0 15px rgb(76, 209, 55)' }}>G</span>
                <span style={{ color: 'rgb(0, 210, 211)', textShadow: '0 0 15px rgb(0, 210, 211)' }}>G</span>
            </div>

            {/* NEON INVITE MESSAGE */}
            {msgParam && (
                <div style={messageBoxStyle}>
                    ⚡ {msgParam} ⚡
                </div>
            )}

            <form style={formStyle} onSubmit={handleSubmit}>
                <h2 style={{ textAlign: 'center', margin: 0, letterSpacing: '3px', color: isRegistering ? 'rgb(0, 210, 211)' : '#fff' }}>
                    {isRegistering ? 'JOIN ARCADE' : 'PLAYER LOGIN'}
                </h2>
                
                <div style={inputGroupStyle}>
                    <label style={{ fontSize: '0.7rem', color: '#666' }}>USERNAME</label>
                    <input 
                        value={username} 
                        onChange={e => setUsername(e.target.value)} 
                        style={inputStyle} 
                        required 
                    />
                </div>

                <div style={inputGroupStyle}>
                    <label style={{ fontSize: '0.7rem', color: '#666' }}>PASSWORD</label>
                    <input 
                        type="password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        style={inputStyle} 
                        required 
                    />
                </div>

                <button type="submit" style={submitBtnStyle}>
                    {isRegistering ? 'CREATE ACCOUNT' : 'START PLAYING'}
                </button>

                {error && <p style={{ color: '#ff4d4d', textAlign: 'center', margin: 0, fontSize: '0.8rem', fontWeight: 'bold' }}>{error}</p>}
                
                <div style={{ textAlign: 'center', borderTop: '1px solid #333', paddingTop: '15px' }}>
                    <button 
                        type="button" 
                        onClick={() => setIsRegistering(!isRegistering)} 
                        style={{ background: 'none', border: 'none', color: 'rgb(0, 210, 211)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.8rem', fontFamily: 'inherit' }}
                    >
                        {isRegistering ? 'ALREADY A MEMBER? SIGN IN' : 'NEW PLAYER? REGISTER HERE'}
                    </button>
                </div>
            </form>

            <button onClick={() => navigate('/')} style={{ marginTop: '30px', background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '0.9rem' }}>
                ← BACK TO LOBBY
            </button>
        </div>
    );
}

export default Login;