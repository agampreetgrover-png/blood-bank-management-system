import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserAuth } from '../hooks/useUserAuth';
import { useToast } from '../context/ToastContext';

// Entry point of the site. One login page for both kinds of account:
// donors/patients (public user accounts) and blood bank staff (admins).
// Opens on the normal user login; staff switch to the admin login from the link below the form.
function LandingPage({ role: initialRole = 'user' }) {
  const [role, setRole] = useState(initialRole);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const adminAuth = useAuth();
  const userAuth = useUserAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/home';

  if (adminAuth.loading || userAuth.loading) return null;
  if (role === 'user' && userAuth.isLoggedIn) return <Navigate to={redirectTo} replace />;
  if (role === 'admin' && adminAuth.isAuthenticated) return <Navigate to="/admin" replace />;

  const switchRole = (next) => {
    setRole(next);
    setIdentifier('');
    setPassword('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (role === 'admin') {
        await adminAuth.login(identifier.trim(), password);
        showToast('Logged in', 'success');
        navigate('/admin', { replace: true });
      } else {
        const data = await userAuth.login(identifier.trim(), password);
        showToast(`Welcome back, ${data.user.full_name.split(' ')[0]}`, 'success');
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isStaff = role === 'admin';

  // Both logins share the admin panel's look (index.css)
  return (
    <div className="app-shell">
      <main className="admin-login">
        <div className="page-header">
          <h2>{isStaff ? 'Admin login' : 'Log in'}</h2>
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-id">{isStaff ? 'Email' : 'Email or mobile'}</label>
            <input
              id="login-id"
              type={isStaff ? 'email' : 'text'}
              className="form-control"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-pass">Password</label>
            <input
              id="login-pass"
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary admin-login-submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <div className="admin-login-footer">
          {isStaff ? (
            <button type="button" onClick={() => switchRole('user')}>Normal user login</button>
          ) : (
            <>
              <Link to="/signup" state={location.state}>Create account</Link>
              <Link to="/home">Skip</Link>
              <button type="button" onClick={() => switchRole('admin')}>Admin login</button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default LandingPage;
