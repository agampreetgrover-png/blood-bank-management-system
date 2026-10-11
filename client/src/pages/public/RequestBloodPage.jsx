import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useUserAuth } from '../../hooks/useUserAuth';
import site from '../../config/site';

const today = () => new Date().toISOString().split('T')[0];

const emptyForm = () => ({
  patient_name: '',
  age: '',
  gender: 'Male',
  blood_group_id: '',
  units_required: '1',
  urgency: 'Normal',
  required_date: today(),
  hospital: '',
  contact_name: '',
  phone: '',
  notes: ''
});

function RequestBloodPage() {
  const [bloodGroups, setBloodGroups] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState(null);
  const { showToast } = useToast();
  const { user, isLoggedIn, loading: authLoading } = useUserAuth();

  // Pre-fill contact details from the signed-in account
  useEffect(() => {
    if (!user || result) return;
    setFormData((prev) => ({
      ...prev,
      contact_name: prev.contact_name || user.full_name,
      phone: prev.phone || user.phone
    }));
  }, [user, result]);

  useEffect(() => {
    api.get('/dashboard/blood-groups')
      .then((res) => setBloodGroups(res.data || []))
      .catch(() => setErrorMessage('Blood groups could not be loaded. Refresh the page to try again.'));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const phone = formData.phone.replace(/[\s-]/g, '');
    if (!/^\d{10}$/.test(phone)) {
      setErrorMessage('Enter a 10-digit mobile number, without +91 or 0 in front.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/public/blood-request', {
        ...formData,
        phone,
        age: parseInt(formData.age, 10),
        blood_group_id: parseInt(formData.blood_group_id, 10),
        units_required: parseInt(formData.units_required, 10)
      });
      setResult({ ...res.data, phone });
      showToast('Request sent', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg = err.response?.data?.message || 'The request could not be sent. Check your connection and try again.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Requests belong to an account so that only the requester (and staff) can follow them
  if (authLoading) return null;
  if (!isLoggedIn) return <Navigate to="/login" state={{ from: '/request-blood' }} replace />;

  if (result) {
    return (
      <div className="pub-container pub-page pub-narrow">
        <div className="confirmation-card">
          <div className="confirmation-header">
            <span className="confirmation-badge">Request sent</span>
            <h2>We've got your request</h2>
            <p className="confirmation-subtitle">
              We'll check it with the hospital and call you on {result.phone}.
              If the patient's condition is critical, call {site.helpline} as well.
            </p>
          </div>
          <div className="appointment-receipt">
            <div className="receipt-row"><span className="receipt-label">Reference number</span><span className="receipt-val reference-val">{result.reference}</span></div>
            <div className="receipt-row"><span className="receipt-label">Patient</span><span className="receipt-val"><strong>{result.patient_name}</strong></span></div>
            <div className="receipt-row"><span className="receipt-label">Blood group</span><span className="receipt-val"><span className="blood-badge">{result.blood_group}</span></span></div>
            <div className="receipt-row"><span className="receipt-label">Units</span><span className="receipt-val">{result.units_required}</span></div>
            <div className="receipt-row"><span className="receipt-label">Hospital</span><span className="receipt-val">{result.hospital}</span></div>
            <div className="receipt-row"><span className="receipt-label">Urgency</span><span className="receipt-val">{result.urgency}</span></div>
            <div className="receipt-row"><span className="receipt-label">Status</span><span className="receipt-val">{result.status}</span></div>
          </div>
          <p className="pub-muted">
            You can follow this request any time under{' '}
            <Link to="/track">Track a request</Link>.
          </p>
          <div className="confirmation-actions">
            <button type="button" className="btn btn-secondary" onClick={() => window.print()}>Print this page</button>
            <button type="button" className="btn btn-primary" onClick={() => { setResult(null); setFormData(emptyForm()); }}>
              Send another request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pub-container pub-page pub-narrow">
      <div className="pub-page-header">
        <h1>Request blood</h1>
      </div>

      {errorMessage && <div className="alert alert-error" role="alert"><span>{errorMessage}</span></div>}

      <form onSubmit={handleSubmit} className="public-signup-form">
        <div className="form-section">
          <h2 className="section-title">Patient</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="rq-name">Patient's full name *</label>
              <input id="rq-name" name="patient_name" className="form-control" value={formData.patient_name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="rq-hospital">Hospital *</label>
              <input id="rq-hospital" name="hospital" className="form-control" placeholder="Where the patient is admitted" value={formData.hospital} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="rq-age">Age *</label>
              <input id="rq-age" name="age" type="number" min="0" max="120" className="form-control" value={formData.age} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="rq-gender">Gender *</label>
              <select id="rq-gender" name="gender" className="form-control" value={formData.gender} onChange={handleChange}>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2 className="section-title">Blood needed</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="rq-group">Blood group *</label>
              <select id="rq-group" name="blood_group_id" className="form-control" value={formData.blood_group_id} onChange={handleChange} required>
                <option value="">Select blood group</option>
                {bloodGroups.map((bg) => <option key={bg.id} value={bg.id}>{bg.group_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="rq-units">Units needed (1–10) *</label>
              <input id="rq-units" name="units_required" type="number" min="1" max="10" className="form-control" value={formData.units_required} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="rq-urgency">Urgency *</label>
              <select id="rq-urgency" name="urgency" className="form-control" value={formData.urgency} onChange={handleChange}>
                <option value="Normal">Normal (planned surgery or procedure)</option>
                <option value="Urgent">Urgent (within 24 hours)</option>
                <option value="Critical">Critical (right now)</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="rq-date">Needed by *</label>
              <input id="rq-date" name="required_date" type="date" min={today()} className="form-control" value={formData.required_date} onChange={handleChange} required />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-group">
            <label htmlFor="rq-notes">Anything else we should know</label>
            <textarea id="rq-notes" name="notes" rows="3" className="form-control" placeholder="Diagnosis, ward and bed number, or the component needed (PRBC, platelets, plasma)" value={formData.notes} onChange={handleChange} />
          </div>
        </div>

        <div className="form-actions-bar">
          <button type="submit" className="btn btn-secondary" disabled={submitting}>
            {submitting ? 'Sending…' : 'Request blood'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default RequestBloodPage;
