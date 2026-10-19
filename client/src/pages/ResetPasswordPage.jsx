import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUserAuth, passwordProblem } from '../hooks/useUserAuth';
import { useToast } from '../context/ToastContext';
import CodeStep from '../components/CodeStep';
import PasswordInput from '../components/PasswordInput';

// Forgotten password for public accounts: email or mobile + a code from the authenticator app
// (or a backup code) + the new password, all in one form.
// Logged-in users can use it to change their password too. Either way the person ends up logged in
// here and every other session for the account is signed out.
function ResetPasswordPage() {
  const { user, resetPassword } = useUserAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const from = location.state?.from;
  const redirectTo = from && !from.startsWith('/admin') ? from : '/account';

  const handleVerify = async (code) => {
    await resetPassword(identifier.trim(), code, password);
    showToast('Password changed', 'success');
    navigate(redirectTo, { replace: true });
  };

  // Same look as the login page (index.css)
  return (
    <div className="app-shell">
      <main className="admin-login">
        <div className="page-header">
          <h2>Reset your password</h2>
        </div>

        <p className="auth-note">
          Enter the code from your authenticator app. Lost your phone? Use a backup code, or ask the blood bank
          staff to reset your authenticator.
        </p>

        <CodeStep
          intro={null}
          autoFocus={false}
          submitLabel="Set new password"
          validate={() => (identifier.trim() ? passwordProblem(password, confirmation) : 'Enter your email or mobile number.')}
          onVerify={handleVerify}
          fieldsBefore={
            <div className="form-group">
              <label htmlFor="reset-id">Email or mobile</label>
              <input
                id="reset-id"
                type="text"
                className="form-control"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
          }
        >
          <div className="form-group">
            <label htmlFor="reset-pass">New password</label>
            <PasswordInput
              id="reset-pass"
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
            <PasswordInput
              id="reset-pass2"
              className="form-control"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
        </CodeStep>

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
