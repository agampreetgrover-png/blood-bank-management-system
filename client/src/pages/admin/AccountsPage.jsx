import { useState } from 'react';
import api from '../../services/api';
import { useFilteredList } from '../../hooks/useAdminData';
import SearchInput from '../../components/SearchInput';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/format';

// Public website accounts. Staff can reset a user's authenticator app (e.g. a lost phone):
// the user is signed out and sets up a new one at their next login.
function AccountsPage() {
  const [search, setSearch] = useState('');
  const { items: accounts, loading, reload } = useFilteredList(
    '/accounts',
    { search: search.trim() },
    'Could not load accounts'
  );
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);
  const { showToast } = useToast();

  const executeReset = async () => {
    setResetting(true);
    try {
      const res = await api.post(`/accounts/${resetTarget.id}/reset-authenticator`);
      showToast(res.data?.message || 'Authenticator reset', 'success');
      setResetTarget(null);
      reload();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not reset the authenticator', 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Accounts</h2>
          <p className="page-subtitle">People who log in to the public website</p>
        </div>
      </div>

      <div className="toolbar">
        <SearchInput
          placeholder="Search by name, phone or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading accounts...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="empty-state">
          {search.trim() ? (
            <>
              <p>No accounts match your search.</p>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSearch('')}>
                Clear Search
              </button>
            </>
          ) : (
            <p>No one has created an account yet.</p>
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
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Group</th>
                    <th>Authenticator</th>
                    <th>Backup codes</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id}>
                      <td><strong>{a.full_name}</strong></td>
                      <td>{a.email}</td>
                      <td className="phone-cell">{a.phone}</td>
                      <td>{a.blood_group ? <span className="blood-badge">{a.blood_group}</span> : <span className="cell-note">—</span>}</td>
                      <td>{a.has_authenticator ? 'On' : <span className="cell-note">Not set up</span>}</td>
                      <td>{a.has_authenticator ? `${a.backup_codes_left} left` : <span className="cell-note">—</span>}</td>
                      <td>
                        <span className={`status-pill pill-${a.is_active ? 'active' : 'inactive'}`}>
                          {a.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="date-cell">{formatDate(a.created_at, '—')}</td>
                      <td>
                        {a.has_authenticator ? (
                          <button className="btn btn-sm btn-danger-text" onClick={() => setResetTarget(a)}>
                            Reset authenticator
                          </button>
                        ) : (
                          <span className="cell-note">—</span>
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

      <ConfirmModal
        isOpen={Boolean(resetTarget)}
        title="Reset authenticator"
        message={`Reset the authenticator for ${resetTarget?.full_name}? Their backup codes stop working and they are signed out. They will set up a new authenticator at their next login.`}
        confirmText="Reset authenticator"
        loading={resetting}
        onConfirm={executeReset}
        onClose={() => setResetTarget(null)}
      />
    </div>
  );
}

export default AccountsPage;
