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
  hospital: '',
  phone: ''
};

function PatientsPage() {
  const [search, setSearch] = useState('');
  const [filterBG, setFilterBG] = useState('');
  const bloodGroups = useBloodGroups();
  const { items: patients, loading, reload: fetchPatients } = useFilteredList(
    '/patients',
    { search: search.trim(), blood_group: filterBG },
    'Could not load patient list'
  );

  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const setField = (name) => (e) => setFormData((prev) => ({ ...prev, [name]: e.target.value }));

  const openAddModal = () => {
    setEditingPatient(null);
    setFormData(EMPTY_FORM);
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
      await api.delete(`/patients/${deactivateTarget.id}`);
      showToast('Patient marked inactive', 'info');
      setDeactivateTarget(null);
      fetchPatients();
    } catch {
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
    } catch {
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
          className="form-control filter-select"
          value={filterBG}
          onChange={(e) => setFilterBG(e.target.value)}
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
                onClick={openAddModal}
              >
                + Register First Patient
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
                              onClick={() => setDeactivateTarget(p)}
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
                onChange={setField('full_name')}
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
                <label>Required Blood Group *</label>
                <select
                  className="form-control"
                  value={formData.blood_group_id}
                  onChange={setField('blood_group_id')}
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
                  onChange={setField('hospital')}
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
                onChange={setField('phone')}
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
        isOpen={Boolean(deactivateTarget)}
        title="Deactivate Patient Record"
        message={`Deactivate patient "${deactivateTarget?.full_name}"?`}
        confirmText="Deactivate"
        onConfirm={executeDelete}
        onClose={() => setDeactivateTarget(null)}
      />
    </div>
  );
}

export default PatientsPage;
