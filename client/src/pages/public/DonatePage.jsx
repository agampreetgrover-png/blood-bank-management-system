import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { today } from '../../utils/dates';
import { useToast } from '../../context/ToastContext';
import { useUserAuth } from '../../hooks/useUserAuth';

// Used when the API can't be reached: the 8 standard groups (ids match seed.sql)
const STANDARD_GROUPS = [
  { id: 1, group_name: 'A+' },
  { id: 2, group_name: 'A-' },
  { id: 3, group_name: 'B+' },
  { id: 4, group_name: 'B-' },
  { id: 5, group_name: 'AB+' },
  { id: 6, group_name: 'AB-' },
  { id: 7, group_name: 'O+' },
  { id: 8, group_name: 'O-' }
];

function DonatePage() {
  const [bloodGroups, setBloodGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedData, setSubmittedData] = useState(null);

  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    gender: 'Male',
    blood_group_id: '',
    phone: '',
    email: '',
    address: '',
    donation_date: today(),
    notes: '',
    accepted_terms: false
  });

  const { showToast } = useToast();
  const { user } = useUserAuth();

  // Pre-fill blank fields from the signed-in account
  useEffect(() => {
    if (!user || submittedData) return;
    setFormData((prev) => ({
      ...prev,
      full_name: prev.full_name || user.full_name,
      phone: prev.phone || user.phone,
      email: prev.email || user.email,
      blood_group_id: prev.blood_group_id || (user.blood_group_id ? String(user.blood_group_id) : '')
    }));
  }, [user, submittedData]);

  useEffect(() => {
    api.get('/dashboard/blood-groups')
      .then((res) => setBloodGroups(res.data || []))
      .catch(() => setBloodGroups(STANDARD_GROUPS))
      .finally(() => setLoadingGroups(false));
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanName = formData.full_name.trim();
    const cleanPhone = formData.phone.replace(/[\s-]/g, '');
    const ageNum = parseInt(formData.age, 10);

    if (!cleanName) {
      setErrorMessage('Enter your full name.');
      return;
    }

    if (isNaN(ageNum) || ageNum < 18 || ageNum > 65) {
      setErrorMessage('Donors need to be between 18 and 65 years old.');
      return;
    }

    if (!cleanPhone || !/^\d{10}$/.test(cleanPhone)) {
      setErrorMessage('Enter a 10-digit mobile number, without +91 or 0 in front.');
      return;
    }

    if (!formData.blood_group_id) {
      setErrorMessage('Choose your blood group.');
      return;
    }

    if (!formData.accepted_terms) {
      setErrorMessage('Tick the box at the end of the form to confirm you can donate.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        full_name: cleanName,
        age: ageNum,
        gender: formData.gender,
        blood_group_id: parseInt(formData.blood_group_id, 10),
        phone: cleanPhone,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        donation_date: formData.donation_date,
        notes: formData.notes.trim() || null
      };

      const res = await api.post('/donations/public-signup', payload);
      setSubmittedData({ ...res.data, donor_phone: cleanPhone });
      showToast('Donation booked', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg = err.response?.data?.message || 'The form could not be sent. Check your connection and try again.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Back to the filled-in form, e.g. to pick another date. Sending it again updates this booking.
  // (An account has one donor profile, so the form can't be reused to register someone else.)
  const handleChangeBooking = () => {
    setSubmittedData(null);
    setErrorMessage('');
  };

  return (
    <div className="pub-container pub-page pub-narrow">
        {submittedData ? (
          <div className="confirmation-card">
            <div className="confirmation-header">
              <span className="confirmation-badge">
                {submittedData.donation_id ? 'Donation booked' : 'Added to donor list'}
              </span>
              <h2>Thanks, {String(submittedData.donor_name || '').split(' ')[0]}</h2>
              <p className="confirmation-subtitle">
                {submittedData.donation_id
                  ? 'Our staff will call you a day before to confirm the time.'
                  : 'We will call you when a patient needs your blood group.'}
              </p>
            </div>

            <div className="appointment-receipt">
              <div className="receipt-row">
                <span className="receipt-label">Reference number</span>
                <span className="receipt-val reference-val">
                  {submittedData.donation_id ? `DON-APPT-${submittedData.donation_id}` : `DNR-${submittedData.donor_id}`}
                </span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Name</span>
                <span className="receipt-val"><strong>{submittedData.donor_name}</strong></span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Blood group</span>
                <span className="receipt-val">
                  <span className="blood-badge">{submittedData.blood_group}</span>
                </span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Mobile</span>
                <span className="receipt-val">{submittedData.donor_phone}</span>
              </div>
              {submittedData.scheduled_date && (
                <div className="receipt-row">
                  <span className="receipt-label">Date</span>
                  <span className="receipt-val">
                    {new Date(submittedData.scheduled_date).toLocaleDateString('en-IN', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              )}
              <div className="receipt-row">
                <span className="receipt-label">Status</span>
                <span className="receipt-val">
                  <span className={`status-pill pill-${(submittedData.status || 'pending').toLowerCase()}`}>
                    {submittedData.status || 'Pending Verification'}
                  </span>
                </span>
              </div>
            </div>

            <div className="guidelines-card">
              <h3>On the day</h3>
              <ul>
                <li>Sleep properly the night before.</li>
                <li>Eat a normal, not too oily, meal 2–3 hours before you come.</li>
                <li>Drink two glasses of water or juice in the hour before.</li>
                <li>Don't smoke for 2 hours before donating.</li>
                <li>Bring a photo ID (Aadhaar, voter ID or driving licence).</li>
              </ul>
            </div>

            <p className="pub-muted">
              You can follow this booking any time under{' '}
              <Link to="/track">Track a request</Link>.
            </p>

            <div className="confirmation-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => window.print()}
              >
                Print this page
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleChangeBooking}
              >
                Change booking
              </button>
            </div>
          </div>
        ) : (
          <div className="public-form-container">
            <div className="public-heading-section">
              <h1>Donate blood</h1>
            </div>

            <div className="eligibility-banner">
              <p className="eligibility-title">You can donate if you are</p>
              <ul className="eligibility-items">
                <li>18 to 65 years old</li>
                <li>at least 45 kg</li>
                <li>90 days or more since your last donation</li>
                <li>well today, with no fever or infection</li>
              </ul>
            </div>

            {errorMessage && (
              <div className="alert alert-error" role="alert">
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="public-signup-form">
              <div className="form-section">
                <h2 className="section-title">About you</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="donor-full-name">Full name *</label>
                    <input
                      id="donor-full-name"
                      name="full_name"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Ramesh Kumar"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="donor-phone">Mobile number *</label>
                    <input
                      id="donor-phone"
                      name="phone"
                      type="tel"
                      maxLength="10"
                      pattern="[0-9]{10}"
                      className="form-control"
                      value={formData.phone}
                      readOnly
                    />
                    <small className="field-hint">The number on your account. We'll call it to confirm.</small>
                  </div>
                </div>

                <div className="form-row form-row-3">
                  <div className="form-group">
                    <label htmlFor="donor-age">Age *</label>
                    <input
                      id="donor-age"
                      name="age"
                      type="number"
                      min="18"
                      max="65"
                      className="form-control"
                      placeholder="18 - 65"
                      value={formData.age}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="donor-gender">Gender *</label>
                    <select
                      id="donor-gender"
                      name="gender"
                      className="form-control"
                      value={formData.gender}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="donor-blood-group">Blood group *</label>
                    <select
                      id="donor-blood-group"
                      name="blood_group_id"
                      className="form-control"
                      value={formData.blood_group_id}
                      onChange={handleInputChange}
                      disabled={loadingGroups}
                      required
                    >
                      <option value="">Select blood group</option>
                      {bloodGroups.map((bg) => (
                        <option key={bg.id} value={bg.id}>
                          {bg.group_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="donor-email">Email (optional)</label>
                    <input
                      id="donor-email"
                      name="email"
                      type="email"
                      className="form-control"
                      placeholder="e.g. ramesh@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="donor-address">Area or address (optional)</label>
                    <input
                      id="donor-address"
                      name="address"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Indiranagar, Bengaluru"
                      value={formData.address}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h2 className="section-title">When can you come?</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="donation-date">Date *</label>
                    <input
                      id="donation-date"
                      name="donation_date"
                      type="date"
                      min={today()}
                      className="form-control"
                      value={formData.donation_date}
                      onChange={handleInputChange}
                      required
                    />
                    <small className="field-hint">Monday to Saturday, 9 am to 5 pm.</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="donation-notes">Preferred time or a note for us (optional)</label>
                    <input
                      id="donation-notes"
                      name="notes"
                      type="text"
                      className="form-control"
                      placeholder="e.g. around 10 am, first time donating"
                      value={formData.notes}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="form-group checkbox-group declaration-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="accepted_terms"
                      checked={formData.accepted_terms}
                      onChange={handleInputChange}
                      required
                    />
                    <span>
                      I'm in good health, weigh at least 45 kg, and haven't had major surgery, a tattoo or a piercing in the last 6 months. I'm donating of my own free will.
                    </span>
                  </label>
                </div>
              </div>

              <div className="form-actions-bar">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Sending…' : 'Book a donation'}
                </button>
              </div>
            </form>
          </div>
        )}
    </div>
  );
}

export default DonatePage;
