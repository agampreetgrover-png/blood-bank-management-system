import { useEffect, useState } from 'react';

// "Enter the code we emailed you" step, shared by sign up, login and password reset.
//   onVerify(code)  - async; should throw on failure. The parent handles success (redirect).
//   onResend()      - async; resolves to the seconds to wait before the next resend
//   onBack()        - go back to the previous step (backLabel names it)
//   validate()      - optional; returns a message to stop the submit, or '' to go ahead
//   children        - optional extra fields shown under the code (e.g. a new password)
function OtpStep({
  email, resendIn, expiresIn = 600, submitLabel = 'Verify', backLabel = 'Use a different email',
  validate, onVerify, onResend, onBack, children
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(resendIn);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    const problem = /^\d{6}$/.test(code) ? validate?.() : 'Enter the 6-digit code from your email.';
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    try {
      await onVerify(code);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not verify the code. Please try again.');
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setNotice('');
    try {
      setSecondsLeft(await onResend());
      setCode('');
      setNotice('A new code is on its way.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send a new code. Please try again.');
      if (err.response?.data?.retry_after) setSecondsLeft(err.response.data.retry_after);
    }
  };

  const minutes = Math.round(expiresIn / 60);

  return (
    <>
      <p className="otp-note">
        We sent a 6-digit code to <strong>{email}</strong>. It expires in {minutes} {minutes === 1 ? 'minute' : 'minutes'}.
      </p>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {notice && <p className="otp-note" role="status">{notice}</p>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="otp-code">Verification code</label>
          <input
            id="otp-code"
            className="form-control otp-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            autoFocus
            required
          />
        </div>
        {children}
        <button type="submit" className="btn btn-primary btn-submit admin-login-submit" disabled={submitting}>
          {submitting ? 'Verifying…' : submitLabel}
        </button>
      </form>

      <div className="otp-actions">
        <button type="button" onClick={onBack}>{backLabel}</button>
        <button type="button" onClick={handleResend} disabled={secondsLeft > 0}>
          {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
        </button>
      </div>
    </>
  );
}

export default OtpStep;
