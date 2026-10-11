import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useUserAuth } from '../../hooks/useUserAuth';
import { useToast } from '../../context/ToastContext';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const pillClass = (status) => `status-pill pill-${String(status).toLowerCase().replace(' ', '-')}`;

function AccountPage() {
  const { user, isLoggedIn, loading: authLoading, logout } = useUserAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn) return;
    api.get('/users/me')
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err.response?.status === 401) {
          logout();
          showToast('Your session has expired. Please log in again.', 'info');
        } else {
          setError('Unable to load your account right now.');
        }
      });
  }, [isLoggedIn]);

  if (authLoading) return null;
  if (!isLoggedIn) return <Navigate to="/login" state={{ from: '/account' }} replace />;

  const profile = data?.user || user;

  const handleLogout = () => {
    logout();
    showToast('Logged out', 'info');
    navigate('/');
  };

  return (
    <div className="pub-container pub-page">
      <div className="pub-page-header pub-account-header">
        <div>
          <h1>My account</h1>
          <p>Welcome, {profile.full_name}.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={handleLogout}>Log out</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="pub-account-grid">
        <aside className="pub-account-profile">
          <h3>Profile</h3>
          <dl>
            <dt>Name</dt><dd>{profile.full_name}</dd>
            <dt>Email</dt><dd>{profile.email}</dd>
            <dt>Mobile</dt><dd>{profile.phone}</dd>
            <dt>Blood group</dt><dd>{profile.blood_group || 'Not set'}</dd>
          </dl>
          <div className="pub-account-actions">
            <Link to="/donate" className="btn btn-primary">Book a donation</Link>
            <Link to="/request-blood" className="btn btn-secondary">Request blood</Link>
          </div>
        </aside>

        <div>
          <section className="card">
            <div className="card-header">
              <h3>Donations</h3>
              <Link to="/donate" className="card-link">Book a donation</Link>
            </div>
            {!data && !error && <p className="pub-muted">Loading…</p>}
            {data && data.donations.length === 0 && (
              <p className="pub-muted">No donations yet. A visit takes about 45 minutes, start to finish.</p>
            )}
            {data && data.donations.length > 0 && (
              <div className="table-container">
                <table>
                  <thead><tr><th>Reference</th><th>Date</th><th>Blood group</th><th>Units</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.donations.map((d) => (
                      <tr key={d.id}>
                        <td className="code-cell">DON-APPT-{d.id}</td>
                        <td>{formatDate(d.donation_date)}</td>
                        <td><span className="blood-badge">{d.blood_group}</span></td>
                        <td>{d.units_donated}</td>
                        <td><span className={pillClass(d.status)}>{d.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-header">
              <h3>Blood requests</h3>
              <Link to="/request-blood" className="card-link">Request blood</Link>
            </div>
            {!data && !error && <p className="pub-muted">Loading…</p>}
            {data && data.requests.length === 0 && (
              <p className="pub-muted">No blood requests yet.</p>
            )}
            {data && data.requests.length > 0 && (
              <div className="table-container">
                <table>
                  <thead><tr><th>Reference</th><th>Patient</th><th>Blood group</th><th>Units</th><th>Hospital</th><th>Needed by</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.requests.map((r) => (
                      <tr key={r.id}>
                        <td className="code-cell">REQ-{r.id}</td>
                        <td>{r.patient_name}</td>
                        <td><span className="blood-badge">{r.blood_group}</span></td>
                        <td>{r.units_required}</td>
                        <td>{r.hospital}</td>
                        <td>{formatDate(r.request_date)}</td>
                        <td><span className={pillClass(r.status)}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default AccountPage;
