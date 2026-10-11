import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import SidebarShell from './SidebarShell';
import { SignOut } from '@phosphor-icons/react';

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/donors', label: 'Donors' },
  { to: '/admin/donations', label: 'Donations' },
  { to: '/admin/patients', label: 'Patients' },
  { to: '/admin/requests', label: 'Requests' },
  { to: '/admin/issues', label: 'Dispensation' }
];

const initialsOf = (name) => (
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
);

function AdminLayout() {
  const { admin, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    showToast('Logged out', 'info');
    navigate('/admin/login');
  };

  const adminName = admin?.name || 'Administrator';

  const footer = (
    <div className="admin-user">
      <span className="admin-avatar" aria-hidden="true">{initialsOf(adminName)}</span>
      <div className="admin-user-details">
        <strong>{adminName}</strong>
        <small>{admin?.email || 'admin@bloodbank.com'}</small>
      </div>
      <button type="button" className="admin-logout" onClick={handleLogout} title="Sign out" aria-label="Log out">
        <SignOut size={18} />
      </button>
    </div>
  );

  return <SidebarShell brand="Admin panel" brandTo="/admin" items={NAV_ITEMS} footer={footer} />;
}

export default AdminLayout;
