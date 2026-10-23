import { useId, useState } from 'react';

// "Enter the code from your authenticator app" form, shared by login, password reset, setup and the account page.
//   onVerify(code)  - async; should throw on failure. The parent handles success.
//   allowBackup     - offer "Use a backup code instead" (an XXXX-XXXX code instead of 6 digits)
//   validate()      - optional; returns a message to stop the submit, or '' to go ahead
//   fieldsBefore    - optional fields shown above the code (e.g. email or mobile)
//   children        - optional fields shown under the code (e.g. a new password)
function CodeStep({
  onVerify, submitLabel = 'Verify', allowBackup = true, validate, fieldsBefore, children,
  intro = 'Enter the 6-digit code from your authenticator app.', autoFocus = true
}) {
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputId = useId();

  const switchMode = () => {
    setUseBackup(!useBackup);
    setCode('');
    setError('');
  };

  // Backup codes are 8 letters/digits; the dash is optional
  const codeProblem = () => {
    if (useBackup) {
      return /^[A-Z0-9]{8}$/.test(code.replace(/-/g, '')) ? '' : 'Enter one of your backup codes, like ABCD-EFGH.';
    }
    return /^\d{6}$/.test(code) ? '' : 'Enter the 6-digit code from your authenticator app.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const problem = validate?.() || codeProblem();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    try {
      await onVerify(code);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not check the code. Please try again.');
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {intro && <p className="auth-note">{useBackup ? 'Enter one of the backup codes you saved when you set up your authenticator. Each code works once.' : intro}</p>}

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <form onSubmit={handleSubmit}>
        {fieldsBefore}
        <div className="form-group">
          <label htmlFor={inputId}>{useBackup ? 'Backup code' : 'Authenticator code'}</label>
          {useBackup ? (
            <input
              id={inputId}
              className="form-control code-input"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={12}
              placeholder="XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
              autoFocus
              required
            />
          ) : (
            <input
              id={inputId}
              className="form-control code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus={autoFocus}
              required
            />
          )}
          {allowBackup && (
            <button type="button" className="link-button code-switch" onClick={switchMode}>
              {useBackup ? 'Use the code from my authenticator app' : 'Use a backup code instead'}
            </button>
          )}
        </div>
        {children}
        <button type="submit" className="btn btn-primary btn-submit admin-login-submit" disabled={submitting}>
          {submitting ? 'Checking…' : submitLabel}
        </button>
      </form>
    </>
  );
}

export default CodeStep;
