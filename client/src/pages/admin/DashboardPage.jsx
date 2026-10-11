import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard/stats');
      setData(res.data);
    } catch (err) {
      setError('Unable to load dashboard data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading overview...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="error-state">
        <p>{error || 'Something went wrong.'}</p>
        <button className="btn btn-secondary" onClick={fetchDashboard}>
          Try Again
        </button>
      </div>
    );
  }

  const { stats, inventory, recentDonations, recentRequests } = data;

  return (
    <div className="admin-dashboard">
      <div className="page-header">
        <h2>Overview</h2>
      </div>

      <p className="overview-line">
        <a href="#inventory"><strong>{stats.total_units}</strong> units in stock</a>
        <Link to="/admin/donors"><strong>{stats.total_donors}</strong> donors</Link>
        <Link to="/admin/patients"><strong>{stats.total_patients}</strong> patients</Link>
        <Link to="/admin/requests"><strong>{stats.pending_requests}</strong> pending requests</Link>
      </p>

      {/* Live Blood Stock */}
      <div id="inventory" className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3>Blood stock</h3>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Blood group</th>
                <th>Units</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {!inventory || inventory.length === 0 ? (
                <tr>
                  <td colSpan="3" className="empty-table-text">No inventory records available.</td>
                </tr>
              ) : (
                inventory.map((item) => {
                  const isZero = item.available_units === 0;
                  const isLow = item.available_units > 0 && item.available_units <= 2;

                  return (
                    <tr key={item.blood_group}>
                      <td><span className="blood-badge">{item.blood_group}</span></td>
                      <td><strong>{item.available_units}</strong></td>
                      <td>
                        <span className={isZero ? 'pill-critical' : isLow ? 'pill-pending' : 'pill-active'}>
                          {isZero ? 'None left' : isLow ? 'Low' : 'Available'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity Split */}
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h3>Recent donations</h3>
            <Link to="/admin/donations" className="card-link">View all</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {recentDonations.length === 0 ? (
              <p className="empty-table-text">No donations logged recently.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Donor</th>
                      <th>Group</th>
                      <th>Units</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDonations.map((d) => (
                      <tr key={d.id}>
                        <td>{d.donor_name}</td>
                        <td><span className="blood-badge">{d.blood_group}</span></td>
                        <td>{d.units_donated}</td>
                        <td className="date-cell">{new Date(d.donation_date).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Recent requests</h3>
            <Link to="/admin/requests" className="card-link">View all</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {recentRequests.length === 0 ? (
              <p className="empty-table-text">No requests submitted yet.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Group</th>
                      <th>Urgency</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRequests.map((r) => (
                      <tr key={r.id}>
                        <td>{r.patient_name}</td>
                        <td><span className="blood-badge">{r.blood_group}</span></td>
                        <td>
                          <span className={`urgency-pill pill-${r.urgency.toLowerCase()}`}>
                            {r.urgency}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill pill-${r.status.toLowerCase()}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
