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
      // FIX: Use a clear variable name like 'res' (response)
      const res = await axios.post(`http://localhost:5000${endpoint}`, {
        username,
        password
      });

      // FIX: Use 'res' here too
      localStorage.setItem('user', res.data.username || res.data.user.username);
      
      alert(res.data.message);
      navigate('/');
      window.location.reload(); 
    } catch (err) {
      // This will now correctly show server errors if they happen
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