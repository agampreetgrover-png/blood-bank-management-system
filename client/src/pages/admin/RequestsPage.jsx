import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/Modal';
import SearchInput from '../../components/SearchInput';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../context/ToastContext';

function RequestsPage() {
  const [requests, setRequests] = useState([]);
  const [patients, setPatients] = useState([]);
  const [bloodGroups, setBloodGroups] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);

  const [confirmDelete, setConfirmDelete] = useState({
    isOpen: false,
    requestId: null
  });

  const [formData, setFormData] = useState({
    patient_id: '',
    blood_group_id: '',
    units_required: 1,
    hospital: '',
    request_date: new Date().toISOString().split('T')[0],
    urgency: 'Normal',
    notes: ''
  });

  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchBloodGroups();
    fetchPatients();
    fetchInventory();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchRequests(), 250);
    return () => clearTimeout(timer);
  }, [search, filterStatus]);

  const fetchRequests = async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/requests', { params });
      setRequests(res.data);
    } catch (err) {
      showToast('Could not load blood requests', 'error');
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
    const item = inventory.find((i) => Number(i.blood_group_id) === Number(bgId));
    return item ? item.available_units : 0;
  };

  const openCreateModal = () => {
    setFormData({
      patient_id: '',
      blood_group_id: '',
      units_required: 1,
      hospital: '',
      request_date: new Date().toISOString().split('T')[0],
      urgency: 'Normal',
      notes: ''
    });
    setFormError('');
    setShowCreateModal(true);
  };

  const handlePatientSelect = (patientId) => {
    const selected = patients.find((p) => p.id === parseInt(patientId, 10));
    setFormData((prev) => ({
      ...prev,
      patient_id: patientId,
      blood_group_id: selected ? selected.blood_group_id : prev.blood_group_id,
      hospital: selected ? selected.hospital : prev.hospital
    }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const units = parseInt(formData.units_required, 10);
    if (!formData.patient_id || !formData.blood_group_id || !formData.hospital.trim()) {
      setFormError('Please select patient and specify hospital.');
      return;
    }

    if (isNaN(units) || units < 1 || units > 10) {
      setFormError('Requisition volume must be between 1 and 10 units.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/requests', {
        ...formData,
        patient_id: parseInt(formData.patient_id, 10),
        blood_group_id: parseInt(formData.blood_group_id, 10),
        units_required: units
      });
      showToast('Requisition order submitted', 'success');
      setShowCreateModal(false);
      fetchRequests();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not create request.');
    } finally {
      setSubmitting(false);
    }
  };

  const openIssueModal = (r) => {
    setActiveRequest(r);
    setIssueDate(new Date().toISOString().split('T')[0]);
    setFormError('');
    setShowIssueModal(true);
    fetchInventory();
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const stock = getAvailableStock(activeRequest.blood_group_id);
    if (stock < activeRequest.units_required) {
      setFormError(`Only ${stock} unit(s) available in current inventory.`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/issues', {
        request_id: activeRequest.id,
        patient_id: activeRequest.patient_id,
        blood_group_id: activeRequest.blood_group_id,
        units_issued: activeRequest.units_required,
        issue_date: issueDate
      });
      showToast('Blood units successfully dispensed', 'success');
      setShowIssueModal(false);
      fetchRequests();
      fetchInventory();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to complete issuance.');
    } finally {
      setSubmitting(false);
    }
  };

  const executeDelete = async () => {
    try {
      await api.delete(`/requests/${confirmDelete.requestId}`);
      showToast('Request canceled', 'info');
      setConfirmDelete({ isOpen: false, requestId: null });
      fetchRequests();
    } catch (err) {
      showToast('Could not delete request', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Blood Requests</h2>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          + New request
        </button>
      </div>

      <div className="toolbar">
        <SearchInput
          placeholder="Filter by patient or hospital..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
        <select
          className="form-control"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ width: 'auto', minWidth: 140 }}
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Fulfilled">Fulfilled</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          {search.trim() || filterStatus ? (
            <>
              <p>No blood requests match your active filters.</p>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ marginTop: 10 }}
                onClick={() => {
                  setSearch('');
                  setFilterStatus('');
                }}
              >
                Clear Filters
              </button>
            </>
          ) : (
            <>
              <p>No active blood requests in queue.</p>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ marginTop: 10 }}
                onClick={openCreateModal}
              >
                + New Request
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
                    <th>Patient</th>
                    <th>Group</th>
                    <th>Units</th>
                    <th>Hospital</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Stock Check</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => {
                    const stock = getAvailableStock(r.blood_group_id);
                    const canIssue = stock >= r.units_required;
                    return (
                      <tr key={r.id}>
                        <td><strong>{r.patient_name}</strong></td>
                        <td><span className="blood-badge">{r.blood_group}</span></td>
                        <td>{r.units_required} unit(s)</td>
                        <td>{r.hospital}</td>
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
                        <td>
                          <span
                            className="stock-reserve-indicator"
                            style={{
                              color: canIssue ? 'var(--text)' : 'var(--danger)',
                              fontWeight: canIssue ? 'normal' : '600'
                            }}
                          >
                            <span className={`status-dot ${canIssue ? 'dot-green' : 'dot-red'}`} aria-hidden="true"></span>
                            <span>{stock} in stock</span>
                          </span>
                        </td>
                        <td>
                          <div className="action-btns">
                            {r.status === 'Pending' ? (
                              <>
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => openIssueModal(r)}
                                  disabled={!canIssue}
                                  title={canIssue ? 'Dispense Blood' : 'Insufficient Stock'}
                                >
                                  Dispense
                                </button>
                                <button
                                  className="btn btn-sm btn-danger-text"
                                  onClick={() => setConfirmDelete({ isOpen: true, requestId: r.id })}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => !submitting && setShowCreateModal(false)}
        title="New Blood Requisition"
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="modal-body">
            {formError && <div className="alert alert-error" role="alert">{formError}</div>}

            <div className="form-group">
              <label>Patient *</label>
              <select
                className="form-control"
                value={formData.patient_id}
                onChange={(e) => handlePatientSelect(e.target.value)}
                required
                autoFocus
              >
                <option value="">Select admitted patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.blood_group}) - {p.hospital}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Required Blood Group *</label>
                <select
                  className="form-control"
                  value={formData.blood_group_id}
                  onChange={(e) => setFormData({ ...formData, blood_group_id: e.target.value })}
                  required
                >
                  <option value="">Select group</option>
                  {bloodGroups.map((bg) => (
                    <option key={bg.id} value={bg.id}>{bg.group_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Units Needed (1–10) *</label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="10"
                  value={formData.units_required}
                  onChange={(e) => setFormData({ ...formData, units_required: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Hospital *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Apollo Hospital"
                  value={formData.hospital}
                  onChange={(e) => setFormData({ ...formData, hospital: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Urgency Priority</label>
                <select
                  className="form-control"
                  value={formData.urgency}
                  onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                >
                  <option value="Normal">Normal</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Critical">Critical (Immediate ICU)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowCreateModal(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Dispense Modal */}
      <Modal
        isOpen={showIssueModal && !!activeRequest}
        onClose={() => !submitting && setShowIssueModal(false)}
        title={`Fulfill Requisition #${activeRequest?.id || ''}`}
      >
        {activeRequest && (
          <form onSubmit={handleIssueSubmit}>
            <div className="modal-body">
              {formError && <div className="alert alert-error" role="alert">{formError}</div>}

              <div className="summary-banner">
                <p>
                  Dispensing <strong>{activeRequest.units_required} unit(s)</strong> of{' '}
                  <strong style={{ color: 'var(--primary)' }}>{activeRequest.blood_group}</strong> for{' '}
                  <strong>{activeRequest.patient_name}</strong> at <em>{activeRequest.hospital}</em>.
                </p>
              </div>

              <div className="form-group">
                <label>Dispensation Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={issueDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowIssueModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Processing...' : 'Confirm Dispensation'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Cancel Request"
        message="Are you sure you want to cancel this pending blood requisition?"
        confirmText="Cancel Request"
        onConfirm={executeDelete}
        onClose={() => setConfirmDelete({ isOpen: false, requestId: null })}
      />
    </div>
  );
}

export default RequestsPage;
