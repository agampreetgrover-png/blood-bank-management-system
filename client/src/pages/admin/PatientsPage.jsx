import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/Modal';
import SearchInput from '../../components/SearchInput';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../context/ToastContext';

function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [bloodGroups, setBloodGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBG, setFilterBG] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);

  const [confirmDelete, setConfirmDelete] = useState({
    isOpen: false,
    patientId: null,
    patientName: ''
  });

  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    gender: 'Male',
    blood_group_id: '',
    hospital: '',
    phone: ''
  });

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchBloodGroups();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchPatients(), 250);
    return () => clearTimeout(timer);
  }, [search, filterBG]);

  const fetchBloodGroups = async () => {
    try {
      const res = await api.get('/dashboard/blood-groups');
      setBloodGroups(res.data);
    } catch (err) {}
  };

  const fetchPatients = async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (filterBG) params.blood_group = filterBG;
      const res = await api.get('/patients', { params });
      setPatients(res.data);
    } catch (err) {
      showToast('Could not load patient list', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingPatient(null);
    setFormData({
      full_name: '',
      age: '',
      gender: 'Male',
      blood_group_id: '',
      hospital: '',
      phone: ''
    });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (p) => {
    setEditingPatient(p);
    setFormData({
      full_name: p.full_name,
      age: p.age.toString(),
      gender: p.gender,
      blood_group_id: p.blood_group_id,
      hospital: p.hospital,
      phone: p.phone
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const cleanPhone = formData.phone.replace(/[\s-]/g, '');
    const ageNum = parseInt(formData.age, 10);

    if (!formData.full_name.trim() || !formData.age || !formData.blood_group_id || !formData.hospital.trim()) {
      setFormError('Please fill in all required fields.');
      return;
    }

    if (isNaN(ageNum) || ageNum < 0 || ageNum > 120) {
      setFormError('Age must be between 0 and 120.');
      return;
    }

    if (!/^\d{10}$/.test(cleanPhone)) {
      setFormError('Phone number must be exactly 10 digits.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        full_name: formData.full_name.trim(),
        age: ageNum,
        gender: formData.gender,
        blood_group_id: parseInt(formData.blood_group_id, 10),
        hospital: formData.hospital.trim(),
        phone: cleanPhone
      };

      if (editingPatient) {
        await api.put(`/patients/${editingPatient.id}`, payload);
        showToast('Patient record updated', 'success');
      } else {
        await api.post('/patients', payload);
        showToast('Patient registered', 'success');
      }

      setShowModal(false);
      fetchPatients();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not save patient.');
    } finally {
      setSubmitting(false);
    }
  };

  const executeDelete = async () => {
    try {
      await api.delete(`/patients/${confirmDelete.patientId}`);
      showToast('Patient marked inactive', 'info');
      setConfirmDelete({ isOpen: false, patientId: null, patientName: '' });
      fetchPatients();
    } catch (err) {
      showToast('Action failed', 'error');
    }
  };

  const handleReactivate = async (patient) => {
    try {
      await api.put(`/patients/${patient.id}`, {
        full_name: patient.full_name,
        age: patient.age,
        gender: patient.gender,
        blood_group_id: patient.blood_group_id,
        hospital: patient.hospital,
        phone: patient.phone,
        is_active: 1
      });
      showToast('Patient record reactivated', 'success');
      fetchPatients();
    } catch (err) {
      showToast('Could not reactivate patient', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Patients</h2>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          + Add patient
        </button>
      </div>

      <div className="toolbar">
        <SearchInput
          placeholder="Search by patient name, hospital..."
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
            <option key={bg.id} value={bg.group_name}>{bg.group_name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading patients...</p>
        </div>
      ) : patients.length === 0 ? (
        <div className="empty-state">
          {search.trim() || filterBG ? (
            <>
              <p>No patients match your search criteria.</p>
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
              <p>No patient records found.</p>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ marginTop: 10 }}
                onClick={openAddModal}
              >
                + Register First Patient
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
                    <th>Age</th>
                    <th>Gender</th>
                    <th>Hospital</th>
                    <th>Contact Phone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.full_name}</strong></td>
                      <td><span className="blood-badge">{p.blood_group}</span></td>
                      <td>{p.age} yrs</td>
                      <td>{p.gender}</td>
                      <td>{p.hospital}</td>
                      <td className="phone-cell">{p.phone}</td>
                      <td>
                        <span className={`status-pill pill-${p.is_active ? 'active' : 'inactive'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="btn btn-sm btn-ghost" onClick={() => openEditModal(p)}>
                            Edit
                          </button>
                          {p.is_active ? (
                            <button
                              className="btn btn-sm btn-danger-text"
                              onClick={() => setConfirmDelete({ isOpen: true, patientId: p.id, patientName: p.full_name })}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => handleReactivate(p)}
                              title="Reactivate Patient"
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
        title={editingPatient ? 'Edit Patient' : 'Register Patient'}
      >
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {formError && <div className="alert alert-error" role="alert">{formError}</div>}

            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Suresh Yadav"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Age *</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="e.g. 42"
                  min="0"
                  max="120"
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
                <label>Hospital / Clinic *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. AIIMS Delhi"
                  value={formData.hospital}
                  onChange={(e) => setFormData({ ...formData, hospital: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Contact Phone (10 digits) *</label>
              <input
                type="tel"
                className="form-control"
                placeholder="e.g. 9811223344"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                maxLength="15"
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
              {submitting ? 'Saving...' : editingPatient ? 'Update Patient' : 'Register Patient'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Deactivate Patient Record"
        message={`Deactivate patient "${confirmDelete.patientName}"?`}
        confirmText="Deactivate"
        onConfirm={executeDelete}
        onClose={() => setConfirmDelete({ isOpen: false, patientId: null, patientName: '' })}
      />
    </div>
  );
}

export default PatientsPage;
