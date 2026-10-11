import { useState, useEffect } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useUserAuth } from '../../hooks/useUserAuth';
import { useToast } from '../../context/ToastContext';

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
  const { register, isLoggedIn } = useUserAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/account';

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const phone = formData.phone.replace(/[\s-]/g, '');
    if (!/^\d{10}$/.test(phone)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        phone,
        password: formData.password,
        blood_group_id: formData.blood_group_id ? parseInt(formData.blood_group_id, 10) : null
      });
      showToast('Account created successfully', 'success');
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pub-container pub-page">
      <div className="pub-auth-card pub-auth-wide">
        <div className="pub-auth-header">
          <h1>Create an account</h1>
        </div>

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
              <input id="us-pass" name="password" type="password" minLength="6" className="form-control" value={formData.password} onChange={handleChange} autoComplete="new-password" required />
              <small className="field-hint">At least 6 characters</small>
            </div>
            <div className="form-group">
              <label htmlFor="us-pass2">Password again *</label>
              <input id="us-pass2" name="confirm_password" type="password" className="form-control" value={formData.confirm_password} onChange={handleChange} autoComplete="new-password" required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="pub-auth-switch">
          Already have an account? <Link to="/login" state={location.state}>Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default UserSignupPage;
