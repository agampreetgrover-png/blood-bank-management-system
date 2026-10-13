import { useState, useEffect } from 'react';
import api from '../../services/api';
import { today } from '../../utils/dates';
import Modal from '../../components/Modal';
import SearchInput from '../../components/SearchInput';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../context/ToastContext';

function DonationsPage() {
  const [donations, setDonations] = useState([]);
  const [donors, setDonors] = useState([]);
  const [bloodGroups, setBloodGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Manual record modal
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    donor_id: '',
    blood_group_id: '',
    donation_date: today(),
    units_donated: 1,
    notes: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Verification & Completion Modal
  const [completeTarget, setCompleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Rejection Modal
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const { showToast } = useToast();

  useEffect(() => {
    fetchBloodGroups();
    fetchDonors();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchDonations(), 250);
    return () => clearTimeout(timer);
  }, [search, filterStatus]);

  const fetchDonations = async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/donations', { params });
      setDonations(res.data);
    } catch (err) {
      showToast('Could not load donations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDonors = async () => {
    try {
      const res = await api.get('/donors', { params: { status: 'active' } });
      setDonors(res.data);
    } catch (err) {}
  };

  const fetchBloodGroups = async () => {
    try {
      const res = await api.get('/dashboard/blood-groups');
      setBloodGroups(res.data);
    } catch (err) {}
  };

  const openModal = () => {
    setFormData({
      donor_id: '',
      blood_group_id: '',
      donation_date: today(),
      units_donated: 1,
      notes: ''
    });
    setFormError('');
    setShowModal(true);
  };

  const handleDonorChange = (donorId) => {
    const donor = donors.find((d) => d.id === parseInt(donorId, 10));
    setFormData((prev) => ({
      ...prev,
      donor_id: donorId,
      blood_group_id: donor ? donor.blood_group_id : ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.donor_id || !formData.blood_group_id || !formData.donation_date) {
      setFormError('Please select a donor and verify collection date.');
      return;
    }

    const units = parseInt(formData.units_donated, 10);
    if (isNaN(units) || units < 1 || units > 3) {
      setFormError('Donation units must be between 1 and 3.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/donations', {
        ...formData,
        units_donated: units
      });
      showToast('Donation logged successfully', 'success');
      setShowModal(false);
      fetchDonations();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to record donation.');
    } finally {
      setSubmitting(false);
    }
  };

  // Admin approves and completes an online pending donation
  const handleConfirmComplete = async () => {
    if (!completeTarget) return;
    setActionLoading(true);
    try {
      await api.put(`/donations/${completeTarget.id}/complete`);
      showToast(`Donation for ${completeTarget.donor_name} completed & inventory updated`, 'success');
      setCompleteTarget(null);
      fetchDonations();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to complete donation', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Admin marks donation request as rejected
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectTarget) return;
    setActionLoading(true);
    try {
      await api.put(`/donations/${rejectTarget.id}/reject`, { reason: rejectReason.trim() });
      showToast('Donation request marked as rejected', 'info');
      setRejectTarget(null);
      setRejectReason('');
      fetchDonations();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reject donation', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Donations & Appointments</h2>
        </div>
        <button className="btn btn-primary" onClick={openModal}>
          + Record donation
        </button>
      </div>

      <div className="toolbar" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SearchInput
            placeholder="Filter by donor name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>
        <select
          className="form-control"
          style={{ width: '180px' }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending Appointments</option>
          <option value="Completed">Completed Donations</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading donations...</p>
        </div>
      ) : donations.length === 0 ? (
        <div className="empty-state">
          {search.trim() || filterStatus ? (
            <>
              <p>No donation records match the selected filters.</p>
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
              <p>No donation records logged yet.</p>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ marginTop: 10 }}
                onClick={openModal}
              >
                + Record First Donation
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
                    <th>Donor Name</th>
                    <th>Contact Phone</th>
                    <th>Group</th>
                    <th>Volume</th>
                    <th>Donation Date</th>
                    <th>Status</th>
                    <th>Notes / Source</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {donations.map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.donor_name}</strong></td>
                      <td className="phone-cell">{d.donor_phone || '—'}</td>
                      <td><span className="blood-badge">{d.blood_group}</span></td>
                      <td>{d.units_donated} unit(s)</td>
                      <td className="date-cell">{new Date(d.donation_date).toLocaleDateString('en-IN')}</td>
                      <td>
                        <span className={`status-pill pill-${d.status.toLowerCase()}`}>
                          {d.status}
                        </span>
                      </td>
                      <td style={{ maxWidth: '200px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        {d.notes || (d.recorded_by ? `Staff: ${d.recorded_by}` : 'Public portal')}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {d.status === 'Pending' ? (
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => setCompleteTarget(d)}
                              title="Verify physical donation & credit inventory"
                            >
                              Approve & Complete
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                setRejectTarget(d);
                                setRejectReason('');
                              }}
                              title="Reject donation request"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {d.status === 'Completed' ? 'Processed' : 'Archived'}
                          </span>
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

      {/* Manual Admin Modal to Record Donation */}
      <Modal
        isOpen={showModal}
        onClose={() => !submitting && setShowModal(false)}
        title="Log In-Person Blood Donation"
      >
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {formError && <div className="alert alert-error" role="alert">{formError}</div>}

            <div className="form-group">
              <label>Donor *</label>
              <select
                className="form-control"
                value={formData.donor_id}
                onChange={(e) => handleDonorChange(e.target.value)}
                required
                autoFocus
              >
                <option value="">Select donor</option>
                {donors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name} ({d.blood_group}) - {d.phone}
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
                  disabled
                  required
                >
                  <option value="">
                    {formData.donor_id ? 'Determining group...' : 'Select donor first'}
                  </option>
                  {bloodGroups.map((bg) => (
                    <option key={bg.id} value={bg.id}>{bg.group_name}</option>
                  ))}
                </select>
                <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginTop: 4 }}>
                  Locked to donor's blood type
                </small>
              </div>
              <div className="form-group">
                <label>Units Collected *</label>
                <select
                  className="form-control"
                  value={formData.units_donated}
                  onChange={(e) => setFormData({ ...formData, units_donated: parseInt(e.target.value, 10) })}
                >
                  <option value={1}>1 Unit (Standard 350ml)</option>
                  <option value={2}>2 Units (Double RBC)</option>
                  <option value={3}>3 Units</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Collection Date *</label>
              <input
                type="date"
                className="form-control"
                value={formData.donation_date}
                max={today()}
                onChange={(e) => setFormData({ ...formData, donation_date: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Remarks</label>
              <input
                type="text"
                className="form-control"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g. Hemoglobin 14.0 g/dL, normal phlebotomy"
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
              {submitting ? 'Recording...' : 'Save Donation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Modal to Approve & Complete Pending Donation */}
      {completeTarget && (
        <ConfirmModal
          isOpen={Boolean(completeTarget)}
          title="Approve & Complete Blood Donation"
          message={`Verify that blood has been successfully collected from ${completeTarget.donor_name}? This will add ${completeTarget.units_donated} unit(s) of ${completeTarget.blood_group} to blood inventory and update the donor's eligibility record.`}
          confirmText="Confirm & Update Stock"
          confirmVariant="primary"
          loading={actionLoading}
          onConfirm={handleConfirmComplete}
          onClose={() => setCompleteTarget(null)}
        />
      )}

      {/* Modal to Reject Pending Donation */}
      {rejectTarget && (
        <Modal
          isOpen={Boolean(rejectTarget)}
          title={`Reject Donation Request - ${rejectTarget.donor_name}`}
          onClose={() => setRejectTarget(null)}
        >
          <form onSubmit={handleConfirmReject}>
            <div className="modal-body">
              <p style={{ marginBottom: '14px', fontSize: '13.5px' }}>
                Are you sure you want to reject this appointment for <strong>{rejectTarget.donor_name}</strong> ({rejectTarget.blood_group})?
              </p>
              <div className="form-group">
                <label>Rejection Reason / Clinical Note</label>
                <input
                  type="text"
                  className="form-control"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Low hemoglobin on screening, donor no-show"
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRejectTarget(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger-fill"
                disabled={actionLoading}
              >
                {actionLoading ? 'Rejecting...' : 'Reject Donation'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default DonationsPage;
