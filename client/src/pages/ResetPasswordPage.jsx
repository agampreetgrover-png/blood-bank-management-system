import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUserAuth, passwordProblem } from '../hooks/useUserAuth';
import { useToast } from '../context/ToastContext';
import OtpStep from '../components/OtpStep';

// Forgotten password for public accounts: email a code, then enter it with a new password.
// Logged-in users can use it to change their password too. Either way the person ends up logged in
// here and every other session for the account is signed out.
function ResetPasswordPage() {
  const { user, requestResetOtp, resetPassword } = useUserAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [otp, setOtp] = useState(null); // { email, resendIn, expiresIn } once a code has been sent

  const from = location.state?.from;
  const redirectTo = from && !from.startsWith('/admin') ? from : '/account';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await requestResetOtp(email.trim());
      setOtp({ email: data.email, resendIn: data.resend_in, expiresIn: data.expires_in });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send the code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (code) => {
    await resetPassword(otp.email, code, password);
    showToast('Password changed', 'success');
    navigate(redirectTo, { replace: true });
  };

  const handleResend = async () => {
    const data = await requestResetOtp(otp.email);
    return data.resend_in;
  };

  // Same look as the login page (index.css)
  return (
    <div className="app-shell">
      <main className="admin-login">
        <div className="page-header">
          <h2>{otp ? 'Set a new password' : 'Reset your password'}</h2>
        </div>

        {otp ? (
          <OtpStep
            email={otp.email}
            resendIn={otp.resendIn}
            expiresIn={otp.expiresIn}
            submitLabel="Set new password"
            validate={() => passwordProblem(password, confirmation)}
            onVerify={handleVerify}
            onResend={handleResend}
            onBack={() => setOtp(null)}
          >
            <div className="form-group">
              <label htmlFor="reset-pass">New password</label>
              <input
                id="reset-pass"
                type="password"
                className="form-control"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <small className="field-hint">At least 8 characters</small>
            </div>
            <div className="form-group">
              <label htmlFor="reset-pass2">New password again</label>
              <input
                id="reset-pass2"
                type="password"
                className="form-control"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          </OtpStep>
        ) : (
          <>
            <p className="otp-note">Enter the email address on your account and we'll send you a code to set a new password.</p>

            {error && <div className="alert alert-error" role="alert">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="reset-email">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary admin-login-submit" disabled={submitting}>
                {submitting ? 'Sending code…' : 'Email me a code'}
              </button>
            </form>
          </>
        )}

        <div className="admin-login-footer">
          {user
            ? <Link to="/account">Back to my account</Link>
            : <Link to="/login" state={location.state}>Back to log in</Link>}
        </div>
      </main>
    </div>
  );
}

export default ResetPasswordPage;
