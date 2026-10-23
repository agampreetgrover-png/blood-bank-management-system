import { useState } from 'react';
import api from '../../services/api';
import { useBloodGroups, useFilteredList } from '../../hooks/useAdminData';
import Modal from '../../components/Modal';
import SearchInput from '../../components/SearchInput';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../context/ToastContext';

const EMPTY_FORM = {
  full_name: '',
  age: '',
  gender: 'Male',
  blood_group_id: '',
  phone: '',
  email: '',
  address: ''
};

function DonorsPage() {
  const [search, setSearch] = useState('');
  const [filterBG, setFilterBG] = useState('');
  const bloodGroups = useBloodGroups();
  const { items: donors, loading, reload: fetchDonors } = useFilteredList(
    '/donors',
    { search: search.trim(), blood_group: filterBG },
    'Could not load donors'
  );

  const [showModal, setShowModal] = useState(false);
  const [editingDonor, setEditingDonor] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const setField = (name) => (e) => setFormData((prev) => ({ ...prev, [name]: e.target.value }));

  const openAddModal = () => {
    setEditingDonor(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (donor) => {
    setEditingDonor(donor);
    setFormData({
      full_name: donor.full_name,
      age: donor.age.toString(),
      gender: donor.gender,
      blood_group_id: donor.blood_group_id,
      phone: donor.phone,
      email: donor.email || '',
      address: donor.address || ''
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const cleanPhone = formData.phone.replace(/[\s-]/g, '');
    const ageNum = parseInt(formData.age, 10);

    if (!formData.full_name.trim() || !formData.age || !formData.blood_group_id || !formData.phone) {
      setFormError('Please fill in all required fields.');
      return;
    }

    if (isNaN(ageNum) || ageNum < 18 || ageNum > 65) {
      setFormError('Donor must be between 18 and 65 years old.');
      return;
    }

    if (!/^\d{10}$/.test(cleanPhone)) {
      setFormError('Please enter a valid 10-digit phone number.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        full_name: formData.full_name.trim(),
        age: ageNum,
        gender: formData.gender,
        blood_group_id: parseInt(formData.blood_group_id, 10),
        phone: cleanPhone,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null
      };

      if (editingDonor) {
        await api.put(`/donors/${editingDonor.id}`, payload);
        showToast('Donor profile updated', 'success');
      } else {
        await api.post('/donors', payload);
        showToast('New donor registered', 'success');
      }

      setShowModal(false);
      fetchDonors();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not save donor record.');
    } finally {
      setSubmitting(false);
    }
  };

  const executeDelete = async () => {
    try {
      await api.delete(`/donors/${deactivateTarget.id}`);
      showToast('Donor marked as inactive', 'info');
      setDeactivateTarget(null);
      fetchDonors();
    } catch {
      showToast('Action failed', 'error');
    }
  };

  const handleReactivate = async (donor) => {
    try {
      await api.put(`/donors/${donor.id}`, {
        full_name: donor.full_name,
        age: donor.age,
        gender: donor.gender,
        blood_group_id: donor.blood_group_id,
        phone: donor.phone,
        email: donor.email || null,
        address: donor.address || null,
        is_active: 1
      });
      showToast('Donor profile reactivated', 'success');
      fetchDonors();
    } catch {
      showToast('Could not reactivate donor', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Donors</h2>
          <p className="page-subtitle">Directory of volunteer blood donors</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          + Add donor
        </button>
      </div>

      <div className="toolbar">
        <SearchInput
          placeholder="Search by name, phone or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
        <select
          className="form-control filter-select"
          value={filterBG}
          onChange={(e) => setFilterBG(e.target.value)}
        >
          <option value="">All Blood Groups</option>
          {bloodGroups.map((bg) => (
            <option key={bg.id} value={bg.group_name}>
              {bg.group_name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading donors...</p>
        </div>
      ) : donors.length === 0 ? (
        <div className="empty-state">
          {search.trim() || filterBG ? (
            <>
              <p>No donors match your search criteria.</p>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setSearch('');
                  setFilterBG('');
                }}
              >
                Clear Filters
              </button>
            </>
          ) : (
            <>
              <p>No donors registered yet.</p>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={openAddModal}
              >
                + Register First Donor
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Group</th>
                    <th>Age</th>
                    <th>Gender</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {donors.map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.full_name}</strong></td>
                      <td><span className="blood-badge">{d.blood_group}</span></td>
                      <td>{d.age} yrs</td>
                      <td>{d.gender}</td>
                      <td className="phone-cell">{d.phone}</td>
                      <td>
                        <span className={`status-pill pill-${d.is_active ? 'active' : 'inactive'}`}>
                          {d.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="btn btn-sm btn-ghost" onClick={() => openEditModal(d)}>
                            Edit
                          </button>
                          {d.is_active ? (
                            <button
                              className="btn btn-sm btn-danger-text"
                              onClick={() => setDeactivateTarget(d)}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => handleReactivate(d)}
                              title="Reactivate Donor"
                            >
                              Activate
                            </button>
                          )}
                        </div>
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
        title={editingDonor ? 'Edit Donor' : 'Register New Donor'}
      >
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {formError && <div className="alert alert-error" role="alert">{formError}</div>}

            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Ananya Roy"
                value={formData.full_name}
                onChange={setField('full_name')}
                required
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Age (18–65) *</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="e.g. 26"
                  min="18"
                  max="65"
                  value={formData.age}
                  onChange={setField('age')}
                  required
                />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select
                  className="form-control"
                  value={formData.gender}
                  onChange={setField('gender')}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Blood Group *</label>
                <select
                  className="form-control"
                  value={formData.blood_group_id}
                  onChange={setField('blood_group_id')}
                  required
                >
                  <option value="">Select blood group</option>
                  {bloodGroups.map((bg) => (
                    <option key={bg.id} value={bg.id}>{bg.group_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Phone *</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="10-digit mobile"
                  value={formData.phone}
                  onChange={setField('phone')}
                  maxLength="15"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                className="form-control"
                placeholder="name@example.com"
                value={formData.email}
                onChange={setField('email')}
              />
            </div>

            <div className="form-group">
              <label>Address</label>
              <input
                type="text"
                className="form-control"
                placeholder="Residential address"
                value={formData.address}
                onChange={setField('address')}
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
              {submitting ? 'Saving...' : editingDonor ? 'Update Donor' : 'Save Donor'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(deactivateTarget)}
        title="Deactivate Donor"
        message={`Mark ${deactivateTarget?.full_name} as inactive?`}
        confirmText="Deactivate"
        onConfirm={executeDelete}
        onClose={() => setDeactivateTarget(null)}
      />
    </div>
  );
}

export default DonorsPage;
