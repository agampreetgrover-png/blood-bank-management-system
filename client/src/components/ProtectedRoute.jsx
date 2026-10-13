import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// Admin panel pages. Logged-out staff go to the admin login and come back here afterwards.
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}

export default ProtectedRoute;
