import { useState, useEffect } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useUserAuth, passwordProblem } from '../../hooks/useUserAuth';
import { useToast } from '../../context/ToastContext';
import OtpStep from '../../components/OtpStep';

// Two steps: enter details + password, then confirm the email with a one-time code.
// The account is only created on the server once the code is verified.
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
  const [otp, setOtp] = useState(null); // { email, resendIn, expiresIn } once a code has been sent
  const { requestSignupOtp, verifySignup, isLoggedIn } = useUserAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const redirectTo = from && !from.startsWith('/admin') ? from : '/account';

  useEffect(() => {
    api.get('/dashboard/blood-groups')
      .then((res) => setBloodGroups(res.data || []))
      .catch(() => setBloodGroups([]));
  }, []);

  if (isLoggedIn) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const sendCode = () => {
    const phone = formData.phone.replace(/[\s-]/g, '');
    return requestSignupOtp({
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
      const data = await sendCode();
      setOtp({ email: data.email, resendIn: data.resend_in, expiresIn: data.expires_in });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send the code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (code) => {
    await verifySignup(otp.email, code);
    showToast('Account created successfully', 'success');
    navigate(redirectTo, { replace: true });
  };

  const handleResend = async () => {
    const data = await sendCode();
    return data.resend_in;
  };

  return (
    <div className="pub-container pub-page">
      <div className="pub-auth-card pub-auth-wide">
        <div className="pub-auth-header">
          <h1>{otp ? 'Verify your email' : 'Create an account'}</h1>
        </div>

        {otp ? (
          <OtpStep
            email={otp.email}
            resendIn={otp.resendIn}
            expiresIn={otp.expiresIn}
            onVerify={handleVerify}
            onResend={handleResend}
            onBack={() => setOtp(null)}
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
              <input id="us-pass" name="password" type="password" minLength="8" className="form-control" value={formData.password} onChange={handleChange} autoComplete="new-password" required />
              <small className="field-hint">At least 8 characters</small>
            </div>
            <div className="form-group">
              <label htmlFor="us-pass2">Password again *</label>
              <input id="us-pass2" name="confirm_password" type="password" className="form-control" value={formData.confirm_password} onChange={handleChange} autoComplete="new-password" required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-submit" disabled={submitting}>
            {submitting ? 'Sending code…' : 'Create account'}
          </button>
          <small className="field-hint">We'll email you a 6-digit code to confirm your address.</small>
        </form>
        </>
        )}

        <p className="pub-auth-switch">
          Already have an account? <Link to="/login" state={location.state}>Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default UserSignupPage;
