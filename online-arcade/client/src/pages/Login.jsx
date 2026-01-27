import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isRegistering ? '/api/register' : '/api/login';
    try {
      const res = await axios.post(endpoint, { username, password });
      if (res.data.status === 'ok') {
        localStorage.setItem('user', res.data.user);
        onLoginSuccess(res.data.user);
        navigate('/');
      }
    } catch (err) {
      alert("Invalid credentials or user already exists.");
    }
  };

  return (
    <div style={{ height: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <form onSubmit={handleSubmit} style={{ background: '#111', padding: '40px', borderRadius: '10px', border: '2px solid #333', width: '350px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>{isRegistering ? 'CREATE ACCOUNT' : 'SYSTEM LOGIN'}</h2>
        
        <input 
          type="text" 
          placeholder="USERNAME" 
          style={inputStyle} 
          onChange={(e) => setUsername(e.target.value)} 
          required 
        />
        <input 
          type="password" 
          placeholder="PASSWORD" 
          style={inputStyle} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        
        <button type="submit" style={submitButtonStyle}>
          {isRegistering ? 'REGISTER' : 'LOGIN'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.8rem', color: '#b2bec3' }}>
          {isRegistering ? 'Already have an account?' : 'Need an account?'}
          <span 
            onClick={() => setIsRegistering(!isRegistering)} 
            style={{ color: '#00d2d3', cursor: 'pointer', marginLeft: '5px', fontWeight: 'bold' }}
          >
            {isRegistering ? 'LOGIN' : 'SIGN UP'}
          </span>
        </p>
      </form>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '12px',
  marginBottom: '20px',
  background: '#000',
  border: '1px solid #333',
  color: '#fff',
  borderRadius: '4px',
  boxSizing: 'border-box'
};

const submitButtonStyle = {
  width: '100%',
  padding: '12px',
  background: '#fff',
  color: '#000',
  border: 'none',
  fontWeight: 'bold',
  cursor: 'pointer',
  borderRadius: '4px'
};

export default Login;