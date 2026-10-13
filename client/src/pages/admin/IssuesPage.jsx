import { useState, useEffect } from 'react';
import api from '../../services/api';
import { today } from '../../utils/dates';
import Modal from '../../components/Modal';
import SearchInput from '../../components/SearchInput';
import { useToast } from '../../context/ToastContext';

function IssuesPage() {
  const [issues, setIssues] = useState([]);
  const [patients, setPatients] = useState([]);
  const [bloodGroups, setBloodGroups] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    patient_id: '',
    blood_group_id: '',
    units_issued: 1,
    issue_date: today(),
    notes: ''
  });

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchBloodGroups();
    fetchPatients();
    fetchInventory();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchIssues(), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchIssues = async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      const res = await api.get('/issues', { params });
      setIssues(res.data);
    } catch (err) {
      showToast('Could not load dispensation logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await api.get('/patients', { params: { status: 'active' } });
      setPatients(res.data);
    } catch (err) {}
  };

  const fetchBloodGroups = async () => {
    try {
      const res = await api.get('/dashboard/blood-groups');
      setBloodGroups(res.data);
    } catch (err) {}
  };

  const fetchInventory = async () => {
    try {
      const res = await api.get('/inventory');
      setInventory(res.data);
    } catch (err) {}
  };

  const getAvailableStock = (bgId) => {
    const item = inventory.find((i) => i.blood_group_id === parseInt(bgId, 10));
    return item ? item.available_units : 0;
  };

  const openNewIssueModal = () => {
    setFormData({
      patient_id: '',
      blood_group_id: '',
      units_issued: 1,
      issue_date: today(),
      notes: ''
    });
    setFormError('');
    setShowModal(true);
    fetchInventory();
  };

  const handlePatientSelection = (pId) => {
    const pat = patients.find((p) => p.id === parseInt(pId, 10));
    setFormData((prev) => ({
      ...prev,
      patient_id: pId,
      blood_group_id: pat ? pat.blood_group_id : ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.patient_id || !formData.blood_group_id) {
      setFormError('Please select patient and blood group.');
      return;
    }

    const units = parseInt(formData.units_issued, 10);
    if (isNaN(units) || units < 1 || units > 10) {
      setFormError('Units to dispense must be between 1 and 10.');
      return;
    }

    const stock = getAvailableStock(formData.blood_group_id);
    if (stock < units) {
      setFormError(`Insufficient stock: Only ${stock} unit(s) available in current inventory.`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/issues', {
        patient_id: parseInt(formData.patient_id, 10),
        blood_group_id: parseInt(formData.blood_group_id, 10),
        units_issued: units,
        issue_date: formData.issue_date,
        notes: formData.notes.trim() || null
      });

      showToast('Blood units successfully dispensed', 'success');
      setShowModal(false);
      fetchIssues();
      fetchInventory();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Transaction could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dispensation Logs</h2>
        </div>
        <button className="btn btn-primary" onClick={openNewIssueModal}>
          + Direct dispense
        </button>
      </div>

      <div className="toolbar">
        <SearchInput
          placeholder="Filter by patient name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading records...</p>
        </div>
      ) : issues.length === 0 ? (
        <div className="empty-state">
          {search.trim() ? (
            <>
              <p>No dispensation transactions match "{search.trim()}".</p>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ marginTop: 10 }}
                onClick={() => setSearch('')}
              >
                Clear Search
              </button>
            </>
          ) : (
            <>
              <p>No dispensation transactions logged yet.</p>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ marginTop: 10 }}
                onClick={openNewIssueModal}
              >
                + Direct Dispense
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Record ID</th>
                    <th>Patient</th>
                    <th>Group</th>
                    <th>Units</th>
                    <th>Issue Date</th>
                    <th>Destination Hospital</th>
                    <th>Source Order</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((item) => (
                    <tr key={item.id}>
                      <td className="code-cell">#{item.id}</td>
                      <td><strong>{item.patient_name}</strong></td>
                      <td><span className="blood-badge">{item.blood_group}</span></td>
                      <td>{item.units_issued} unit(s)</td>
                      <td className="date-cell">{new Date(item.issue_date).toLocaleDateString('en-IN')}</td>
                      <td>{item.hospital || 'Direct Clinic'}</td>
                      <td>
                        {item.request_id ? (
                          <span className="ref-tag">Order #{item.request_id}</span>
                        ) : (
                          <span className="ref-tag tag-direct">Direct</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => !submitting && setShowModal(false)}
        title="Direct Dispensation"
      >
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {formError && <div className="alert alert-error" role="alert">{formError}</div>}

            <div className="form-group">
              <label>Patient Recipient *</label>
              <select
                className="form-control"
                value={formData.patient_id}
                onChange={(e) => handlePatientSelection(e.target.value)}
                required
                autoFocus
              >
                <option value="">Select patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.blood_group}) - {p.hospital}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Blood Group *</label>
                <select
                  className="form-control"
                  value={formData.blood_group_id}
                  onChange={(e) => setFormData({ ...formData, blood_group_id: e.target.value })}
                  required
                >
                  <option value="">Select group</option>
                  {bloodGroups.map((bg) => (
                    <option key={bg.id} value={bg.id}>
                      {bg.group_name} ({getAvailableStock(bg.id)} in stock)
                    </option>
                  ))}
                </select>
                {formData.blood_group_id && (
                  <small style={{ color: getAvailableStock(formData.blood_group_id) < (parseInt(formData.units_issued, 10) || 1) ? 'var(--danger)' : 'var(--text-muted)', fontSize: '11.5px', display: 'block', marginTop: 4 }}>
                    Available stock: {getAvailableStock(formData.blood_group_id)} unit(s)
                  </small>
                )}
              </div>
              <div className="form-group">
                <label>Units to Dispense *</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.units_issued}
                  onChange={(e) => setFormData({ ...formData, units_issued: parseInt(e.target.value, 10) || '' })}
                  min="1"
                  max="10"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Dispensation Date *</label>
              <input
                type="date"
                className="form-control"
                value={formData.issue_date}
                max={today()}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowModal(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Dispensing...' : 'Confirm Dispensation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default IssuesPage;
