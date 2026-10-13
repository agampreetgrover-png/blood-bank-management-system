import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import site from '../../config/site';
import BloodTag from '../../components/BloodTag';

const formatTime = (value) => new Date(value).toLocaleString('en-IN', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
});

function HomePage() {
  const [overview, setOverview] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    api.get('/public/overview')
      .then((res) => setOverview(res.data))
      .catch(() => setLoadError(true));
  }, []);

  const shortGroups = overview?.inventory.filter((i) => i.status !== 'Available').map((i) => i.blood_group) || [];
  const lastUpdated = overview?.inventory.reduce((latest, i) => (
    !latest || new Date(i.last_updated) > new Date(latest) ? i.last_updated : latest
  ), null);

  return (
    <div className="pub-container pub-page">
      <section className="pub-stock">
        <h1>Blood in stock today</h1>
        {lastUpdated && <p className="pub-muted">Updated {formatTime(lastUpdated)}</p>}

        {loadError && (
          <p className="pub-muted">Stock can't be loaded right now. Call {site.helpline} to check.</p>
        )}
        {!overview && !loadError && <p className="pub-muted">Loading…</p>}

        {overview && (
          <div className="pub-tag-row">
            {overview.inventory.map((item) => (
              <BloodTag
                key={item.blood_group}
                group={item.blood_group}
                units={item.available_units}
              />
            ))}
          </div>
        )}

        {shortGroups.length > 0 && (
          <p className="pub-appeal">
            Running low on {shortGroups.join(', ')}. If that's your group, please{' '}
            <Link to="/donate">book a donation</Link>.
          </p>
        )}
      </section>

      <section className="pub-paths">
        <div className="pub-path">
          <h2>Give blood</h2>
          <p>
            Takes about 45 minutes, including a quick health check. You need to be 18–65 and weigh
            at least 45 kg.
          </p>
          <Link to="/donate" className="btn btn-primary">Book a donation</Link>
        </div>

        <div className="pub-path">
          <h2>Need blood for a patient</h2>
          <p>
            Send the patient and hospital details and we'll call you back. If it's an emergency,
            call <span className="pub-nowrap">{site.helpline}</span> first.
          </p>
          <Link to="/request-blood" className="btn btn-secondary">Request blood</Link>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
