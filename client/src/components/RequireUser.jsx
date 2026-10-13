import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUserAuth } from '../hooks/useUserAuth';

// Public pages that belong to an account (bookings, requests, account details).
// Logged-out visitors go to the login page and come back here afterwards.
function RequireUser() {
  const { isLoggedIn } = useUserAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}

export default RequireUser;
