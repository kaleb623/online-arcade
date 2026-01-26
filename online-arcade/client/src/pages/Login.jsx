import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isRegistering ? '/api/register' : '/api/login';

    try {
      // 1. Send the request (Uses the 'username' STATE)
      const res = await axios.post(endpoint, { username, password });

      // 2. EXTRACT DATA (renamed variable to avoid crash)
      // We look for 'user' because that's what we put in server/index.js
      const serverUser = res.data.user; 
      const serverMessage = res.data.message;

      // 3. Save to Storage
      localStorage.setItem('user', serverUser);
      
      // 4. Success!
      alert(serverMessage); 
      navigate('/');
      window.location.reload(); 
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "An error occurred");
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>{isRegistering ? "Create Account" : "Login"}</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ margin: '10px' }}>
          <input 
            placeholder="Username"
            value={username} 
            onChange={e => setUsername(e.target.value)}
            required 
          />
        </div>
        <div style={{ margin: '10px' }}>
          <input 
            type="password" 
            placeholder="Password"
            value={password} 
            onChange={e => setPassword(e.target.value)}
            required 
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">{isRegistering ? "Register" : "Login"}</button>
      </form>
      <p style={{ color: 'blue', cursor: 'pointer' }} onClick={() => setIsRegistering(!isRegistering)}>
        {isRegistering ? "Have an account? Login" : "Need an account? Register"}
      </p>
    </div>
  );
}

export default Login;