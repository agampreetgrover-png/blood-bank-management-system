import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import site from '../../config/site';
import BloodTag from '../../components/BloodTag';

// Red-cell compatibility: which donor groups a patient of each group can receive
const canReceiveFrom = {
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'A-': ['A-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+': ['O+', 'O-'],
  'O-': ['O-']
};

function BloodAvailabilityPage() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');

  useEffect(() => {
    api.get('/inventory')
      .then((res) => setInventory(res.data))
      .catch(() => setError(`Stock levels can't be loaded right now. Call ${site.helpline} to check availability.`))
      .finally(() => setLoading(false));
  }, []);

  const itemFor = (group) => inventory.find((i) => i.blood_group === group);
  const compatible = selected ? canReceiveFrom[selected] : [];
  const compatibleTotal = compatible.reduce((sum, g) => sum + (itemFor(g)?.available_units ?? 0), 0);


  const statusClass = (item) => (
    item.available_units === 0 ? 'out' : item.status === 'Available' ? 'ok' : 'low'
  );
  const statusLabel = { ok: 'In stock', low: 'Running low', out: 'Out of stock' };

  return (
    <div className="pub-container pub-page">
      <div className="pub-page-header">
        <h1>Blood stock</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="pub-muted">Loading stock…</p>}

      {!loading && !error && (
        <>
          <div className="table-container">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Blood group</th>
                  <th>Units</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) => {
                  const isSelected = selected === item.blood_group;
                  return (
                    <tr
                      key={item.blood_group}
                      className={`stock-row stock-${statusClass(item)}${isSelected ? ' stock-row-selected' : ''}`}
                      onClick={() => setSelected(isSelected ? '' : item.blood_group)}
                    >
                      <td>
                        <button type="button" className="stock-pick" aria-pressed={isSelected}>
                          {item.blood_group}
                        </button>
                      </td>
                      <td>{item.available_units}</td>
                      <td className="stock-status">{statusLabel[statusClass(item)]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selected ? (
            <div className="pub-compat-box">
              <h2>{selected} can receive blood from</h2>
              <div className="pub-compat-list">
                {compatible.map((g) => {
                  const item = itemFor(g);
                  return (
                    <BloodTag
                      key={g}
                      group={g}
                      units={item?.available_units ?? 0}
                    />
                  );
                })}
              </div>
              <p><strong>{compatibleTotal} {compatibleTotal === 1 ? 'unit' : 'units'}</strong> available across these groups</p>
              <Link to="/request-blood" className="btn btn-primary">Request {selected} blood</Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default BloodAvailabilityPage;
