import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserAuth } from '../hooks/useUserAuth';
import { useToast } from '../context/ToastContext';
import CodeStep from '../components/CodeStep';
import AuthenticatorSetup from '../components/AuthenticatorSetup';
import BackupCodes from '../components/BackupCodes';
import PasswordInput from '../components/PasswordInput';

// Entry point of the site. One login page for both kinds of account:
// donors/patients (public user accounts: email/mobile + password, then the code from their authenticator app;
// accounts without one set it up here first) and blood bank staff (admins, email + password).
// Opens on the normal user login; staff switch to the admin login from the link below the form.
// Exactly what the server sends for an expired or stale mfa_token
const LOGIN_EXPIRED = 'Your login has expired. Please log in again.';

function LandingPage({ role: initialRole = 'user' }) {
  const [role, setRole] = useState(initialRole);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mfa, setMfa] = useState(null); // { stage, mfa_token, setup? } once the password is accepted
  const [pending, setPending] = useState(null); // login reply held back until the new backup codes are saved

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
    setMfa(null);
    setPending(null);
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
        setMfa(await userAuth.login(identifier.trim(), password));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const finish = (data) => {
    userAuth.startSession(data);
    showToast(`Welcome back, ${data.user.full_name.split(' ')[0]}`, 'success');
    // Nudge them to get new backup codes before they run out
    const left = data.backup_codes_left;
    if (left !== undefined && left <= 2) {
      const count = left === 0 ? 'no backup codes' : left === 1 ? '1 backup code' : `${left} backup codes`;
      showToast(`You have ${count} left. Get new ones from My account.`, 'info');
    }
    navigate(userRedirect, { replace: true });
  };

  // A first-time setup hands out backup codes, which are shown before the session starts
  // An expired login (the 5-minute mfa_token) goes back to the password step with the message there
  const handleVerify = async (code) => {
    let data;
    try {
      data = await userAuth.verifyLogin(mfa.mfa_token, code);
    } catch (err) {
      const message = err.response?.data?.message;
      if (message !== LOGIN_EXPIRED) throw err;
      setMfa(null);
      setPassword('');
      setError(message);
      return;
    }
    if (data.backup_codes) setPending(data);
    else finish(data);
  };

  const isStaff = role === 'admin';
  const heading = isStaff
    ? 'Admin login'
    : pending ? 'Save your backup codes'
    : mfa?.stage === 'setup' ? 'Set up your authenticator'
    : mfa ? 'Enter your code'
    : 'Log in';

  // Both logins share the admin panel's look (index.css)
  return (
    <div className="app-shell">
      <main className="admin-login">
        <div className="page-header">
          <h2>{heading}</h2>
        </div>

        {pending ? (
          <BackupCodes codes={pending.backup_codes} onContinue={() => finish(pending)} />
        ) : mfa?.stage === 'setup' ? (
          <>
            <p className="auth-note">Your account now needs an authenticator app to log in. It only takes a minute.</p>
            <AuthenticatorSetup setup={mfa.setup} submitLabel="Log in" onVerify={handleVerify} onBack={() => setMfa(null)} />
          </>
        ) : mfa ? (
          <>
            <CodeStep submitLabel="Log in" onVerify={handleVerify} />
            <div className="auth-actions">
              <button type="button" className="link-button" onClick={() => setMfa(null)}>Back</button>
            </div>
          </>
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
                <PasswordInput
                  id="login-pass"
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
              {!isStaff && <small className="field-hint">You'll need the code from your authenticator app.</small>}
            </form>
          </>
        )}

        {/* Hidden while the backup codes are on screen, so they can't be left behind by accident */}
        {!pending && (
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
        )}
      </main>
    </div>
  );
}

export default LandingPage;
