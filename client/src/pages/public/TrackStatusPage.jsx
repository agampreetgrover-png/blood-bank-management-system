import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  : '');
const pillClass = (status) => `status-pill pill-${String(status).toLowerCase().replace(' ', '-')}`;

// Shows only the logged-in user's own requests and bookings. The server filters by
// account, so there is no way to look up someone else's record from here.
function TrackStatusPage() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users/me')
      .then((res) => setData(res.data))
      .catch((err) => {
        // On a 401 the session has already ended (services/api.js) and RequireUser sends them to log in
        if (err.response?.status === 401) {
          showToast('Your session has expired. Log in again to see your requests.', 'info');
        } else {
          setError('Your requests could not be loaded. Refresh the page to try again.');
        }
      });
  }, []);

  const donor = data?.donor;

  return (
    <div className="pub-container pub-page pub-narrow">
      <div className="pub-page-header">
        <h1>Your requests and bookings</h1>
        <p>Everything you&apos;ve sent us from this account, with its current status.</p>
      </div>

      {error && <div className="alert alert-error" role="alert"><span>{error}</span></div>}
      {!data && !error && <p className="pub-muted">Loading…</p>}

      {data && (
        <>
          <section className="track-section">
            <h2 className="section-title">Blood requests</h2>
            {data.requests.length === 0 ? (
              <p className="pub-muted">
                No blood requests yet. <Link to="/request-blood">Request blood</Link>
              </p>
            ) : (
              <ul className="track-list">
                {data.requests.map((r) => (
                  <li key={r.id} className="track-item">
                    <div>
                      <strong>REQ-{r.id}</strong>
                      <span className="track-meta">
                        {r.patient_name}, {r.blood_group}, {r.units_required} {r.units_required === 1 ? 'unit' : 'units'}
                      </span>
                      <span className="track-meta">{r.hospital}. Needed by {formatDate(r.request_date)}</span>
                    </div>
                    <span className={pillClass(r.status)}>{r.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="track-section">
            <h2 className="section-title">Donation bookings</h2>
            {data.donations.length === 0 ? (
              <p className="pub-muted">
                No bookings yet. <Link to="/donate">Book a donation</Link>
              </p>
            ) : (
              <ul className="track-list">
                {data.donations.map((d) => (
                  <li key={d.id} className="track-item">
                    <div>
                      <strong>DON-APPT-{d.id}</strong>
                      <span className="track-meta">{formatDate(d.donation_date)}, {d.blood_group}</span>
                    </div>
                    <span className={pillClass(d.status)}>{d.status}</span>
                  </li>
                ))}
              </ul>
            )}
            {donor && (
              <p className="pub-muted track-donor">
                {!donor.is_active
                  ? 'Your donor profile is inactive. Call the blood bank if this is a mistake.'
                  : donor.is_eligible
                    ? `You're on our donor list${donor.last_donation_date ? `. Last donation: ${formatDate(donor.last_donation_date)}` : ''}.`
                    : 'Your donor profile is marked not eligible right now. Staff will tell you when you can donate again.'}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default TrackStatusPage;
