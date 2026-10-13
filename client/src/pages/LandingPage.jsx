import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserAuth } from '../hooks/useUserAuth';
import { useToast } from '../context/ToastContext';
import OtpStep from '../components/OtpStep';

// Entry point of the site. One login page for both kinds of account:
// donors/patients (public user accounts: email/mobile + password, then a code emailed to them)
// and blood bank staff (admins, email + password).
// Opens on the normal user login; staff switch to the admin login from the link below the form.
function LandingPage({ role: initialRole = 'user' }) {
  const [role, setRole] = useState(initialRole);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [otp, setOtp] = useState(null); // { email, resendIn, expiresIn } once the password is accepted and a code sent

  const adminAuth = useAuth();
  const userAuth = useUserAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Go back to the page that sent them here, as long as it belongs to the kind of account logging in
  const from = location.state?.from;
  const isAdminPath = from === '/admin' || Boolean(from?.startsWith('/admin/'));
  const userRedirect = from && !isAdminPath ? from : '/home';
  const adminRedirect = isAdminPath ? from : '/admin';

  if (role === 'user' && userAuth.isLoggedIn) return <Navigate to={userRedirect} replace />;
  if (role === 'admin' && adminAuth.isAuthenticated) return <Navigate to={adminRedirect} replace />;

  const switchRole = (next) => {
    setRole(next);
    setIdentifier('');
    setPassword('');
    setError('');
    setOtp(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (role === 'admin') {
        await adminAuth.login(identifier.trim(), password);
        showToast('Logged in', 'success');
        navigate(adminRedirect, { replace: true });
      } else {
        const data = await userAuth.login(identifier.trim(), password);
        setOtp({ email: data.email, resendIn: data.resend_in, expiresIn: data.expires_in });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (code) => {
    const data = await userAuth.verifyLogin(identifier.trim(), code);
    showToast(`Welcome back, ${data.user.full_name.split(' ')[0]}`, 'success');
    navigate(userRedirect, { replace: true });
  };

  // A new code needs the password again, so it goes through the same first step
  const handleResend = async () => {
    const data = await userAuth.login(identifier.trim(), password);
    return data.resend_in;
  };

  const isStaff = role === 'admin';

  // Both logins share the admin panel's look (index.css)
  return (
    <div className="app-shell">
      <main className="admin-login">
        <div className="page-header">
          <h2>{isStaff ? 'Admin login' : otp ? 'Check your email' : 'Log in'}</h2>
        </div>

        {otp ? (
          <OtpStep
            email={otp.email}
            resendIn={otp.resendIn}
            expiresIn={otp.expiresIn}
            submitLabel="Log in"
            backLabel="Back"
            onVerify={handleVerify}
            onResend={handleResend}
            onBack={() => setOtp(null)}
          />
        ) : (
          <>
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
                <div className="login-label-row">
                  <label htmlFor="login-pass">Password</label>
                  {!isStaff && <Link to="/reset-password" state={location.state}>Forgot password?</Link>}
                </div>
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
                {isStaff
                  ? (submitting ? 'Logging in…' : 'Log in')
                  : (submitting ? 'Checking…' : 'Continue')}
              </button>
              {!isStaff && <small className="field-hint">We'll email you a 6-digit code to finish logging in.</small>}
            </form>
          </>
        )}

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
