import { useState, useEffect } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useUserAuth, passwordProblem } from '../../hooks/useUserAuth';
import { useToast } from '../../context/ToastContext';
import AuthenticatorSetup from '../../components/AuthenticatorSetup';
import BackupCodes from '../../components/BackupCodes';
import PasswordInput from '../../components/PasswordInput';

// Three steps: enter details + password, link an authenticator app (scan the QR, enter a code),
// then save the backup codes. The account is created on the server once the first code checks out,
// and the session starts after the backup codes are saved.
// Exactly what the server sends for an expired setup_token
const SIGNUP_EXPIRED = 'This sign up has expired. Please start again.';

function UserSignupPage() {
  const [bloodGroups, setBloodGroups] = useState([]);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    blood_group_id: '',
    password: '',
    confirm_password: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [setup, setSetup] = useState(null); // { setup_token, setup: { secret, qr } } once the details are accepted
  const [created, setCreated] = useState(null); // { token, user, backup_codes } once the account exists
  const { startSignup, finishSignup, startSession, isLoggedIn } = useUserAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const redirectTo = from && !from.startsWith('/admin') ? from : '/account';

  useEffect(() => {
    api.get('/dashboard/blood-groups')
      .then((res) => setBloodGroups(res.data || []))
      .catch(() => {}); // optional field: the list just offers "I don't know yet"
  }, []);

  if (isLoggedIn) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const sendDetails = () => {
    const phone = formData.phone.replace(/[\s-]/g, '');
    return startSignup({
      full_name: formData.full_name.trim(),
      email: formData.email.trim(),
      phone,
      password: formData.password,
      blood_group_id: formData.blood_group_id ? parseInt(formData.blood_group_id, 10) : null
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!/^\d{10}$/.test(formData.phone.replace(/[\s-]/g, ''))) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    const problem = passwordProblem(formData.password, formData.confirm_password);
    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    try {
      setSetup(await sendDetails());
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // An expired sign up goes back to the details form, keeping everything but the passwords
  const handleVerify = async (code) => {
    try {
      setCreated(await finishSignup(setup.setup_token, code));
    } catch (err) {
      const message = err.response?.data?.message;
      if (message !== SIGNUP_EXPIRED) throw err;
      setSetup(null);
      setFormData((prev) => ({ ...prev, password: '', confirm_password: '' }));
      setError(message);
    }
  };

  const handleContinue = () => {
    startSession(created);
    showToast('Account created successfully', 'success');
    navigate(redirectTo, { replace: true });
  };

  const heading = created ? 'Save your backup codes' : setup ? 'Set up your authenticator' : 'Create an account';

  return (
    <div className="pub-container pub-page">
      <div className="pub-auth-card pub-auth-wide">
        <div className="pub-auth-header">
          <h1>{heading}</h1>
        </div>

        {created ? (
          <BackupCodes codes={created.backup_codes} onContinue={handleContinue} />
        ) : setup ? (
          <AuthenticatorSetup
            setup={setup.setup}
            submitLabel="Create account"
            onVerify={handleVerify}
            onBack={() => setSetup(null)}
            backLabel="Change my details"
          />
        ) : (
        <>
        {error && <div className="alert alert-error" role="alert"><span>{error}</span></div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="us-name">Full name *</label>
            <input id="us-name" name="full_name" className="form-control" value={formData.full_name} onChange={handleChange} autoComplete="name" autoFocus required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="us-email">Email *</label>
              <input id="us-email" name="email" type="email" className="form-control" value={formData.email} onChange={handleChange} autoComplete="email" required />
            </div>
            <div className="form-group">
              <label htmlFor="us-phone">Mobile number *</label>
              <input id="us-phone" name="phone" type="tel" maxLength="10" className="form-control" value={formData.phone} onChange={handleChange} autoComplete="tel" required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="us-group">Blood group</label>
            <select id="us-group" name="blood_group_id" className="form-control" value={formData.blood_group_id} onChange={handleChange}>
              <option value="">I don't know yet</option>
              {bloodGroups.map((bg) => <option key={bg.id} value={bg.id}>{bg.group_name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="us-pass">Password *</label>
              <PasswordInput id="us-pass" name="password" minLength="8" className="form-control" value={formData.password} onChange={handleChange} autoComplete="new-password" required />
              <small className="field-hint">At least 8 characters</small>
            </div>
            <div className="form-group">
              <label htmlFor="us-pass2">Password again *</label>
              <PasswordInput id="us-pass2" name="confirm_password" className="form-control" value={formData.confirm_password} onChange={handleChange} autoComplete="new-password" required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-submit" disabled={submitting}>
            {submitting ? 'Checking…' : 'Continue'}
          </button>
          <small className="field-hint">Next you'll link an authenticator app (Google or Microsoft Authenticator). You'll need it every time you log in.</small>
        </form>
        </>
        )}

        {!created && (
          <p className="pub-auth-switch">
            Already have an account? <Link to="/login" state={location.state}>Log in</Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default UserSignupPage;
