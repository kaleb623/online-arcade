// client/src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  // Check if user is logged in
  const user = localStorage.getItem('user');

  if (!user) {
    // If not logged in, redirect to Login page
    // 'replace' prevents them from hitting Back and getting stuck in a loop
    return <Navigate to="/login" replace />;
  }

  // If logged in, render the Game (the child component)
  return children;
};

export default ProtectedRoute;