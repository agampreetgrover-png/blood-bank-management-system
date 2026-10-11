import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/Modal';
import SearchInput from '../../components/SearchInput';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../context/ToastContext';

function DonorsPage() {
  const [donors, setDonors] = useState([]);
  const [bloodGroups, setBloodGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBG, setFilterBG] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingDonor, setEditingDonor] = useState(null);

  const [confirmDelete, setConfirmDelete] = useState({
    isOpen: false,
    donorId: null,
    donorName: ''
  });

  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    gender: 'Male',
    blood_group_id: '',
    phone: '',
    email: '',
    address: ''
  });

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchBloodGroups();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchDonors(), 250);
    return () => clearTimeout(timer);
  }, [search, filterBG]);

  const fetchBloodGroups = async () => {
    try {
      const res = await api.get('/dashboard/blood-groups');
      setBloodGroups(res.data);
    } catch (err) {}
  };

  const fetchDonors = async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (filterBG) params.blood_group = filterBG;

      const res = await api.get('/donors', { params });
      setDonors(res.data);
    } catch (err) {
      showToast('Could not load donors', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingDonor(null);
    setFormData({
      full_name: '',
      age: '',
      gender: 'Male',
      blood_group_id: '',
      phone: '',
      email: '',
      address: ''
    });
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
      await api.delete(`/donors/${confirmDelete.donorId}`);
      showToast('Donor marked as inactive', 'info');
      setConfirmDelete({ isOpen: false, donorId: null, donorName: '' });
      fetchDonors();
    } catch (err) {
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
    } catch (err) {
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
          className="form-control"
          value={filterBG}
          onChange={(e) => setFilterBG(e.target.value)}
          style={{ width: 'auto', minWidth: 140 }}
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
                style={{ marginTop: 10 }}
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
                style={{ marginTop: 10 }}
                onClick={openAddModal}
              >
                + Register First Donor
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
                              onClick={() => setConfirmDelete({ isOpen: true, donorId: d.id, donorName: d.full_name })}
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
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select
                  className="form-control"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, blood_group_id: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Address</label>
              <input
                type="text"
                className="form-control"
                placeholder="Residential address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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
        isOpen={confirmDelete.isOpen}
        title="Deactivate Donor"
        message={`Mark ${confirmDelete.donorName} as inactive?`}
        confirmText="Deactivate"
        onConfirm={executeDelete}
        onClose={() => setConfirmDelete({ isOpen: false, donorId: null, donorName: '' })}
      />
    </div>
  );
}

export default DonorsPage;
