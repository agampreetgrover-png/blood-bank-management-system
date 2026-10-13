import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import SidebarShell from './SidebarShell';

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/donors', label: 'Donors' },
  { to: '/admin/donations', label: 'Donations' },
  { to: '/admin/patients', label: 'Patients' },
  { to: '/admin/requests', label: 'Requests' },
  { to: '/admin/issues', label: 'Dispensation' }
];

function AdminLayout() {
  const { admin, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    showToast('Logged out', 'info');
    navigate('/admin/login');
  };

  const footer = (
    <div className="admin-user">
      <strong>{admin?.name || 'Administrator'}</strong>
      <small>{admin?.email || 'admin@bloodbank.com'}</small>
      <button type="button" className="admin-logout" onClick={handleLogout}>Log out</button>
    </div>
  );

  return <SidebarShell brand="Admin panel" brandTo="/admin" items={NAV_ITEMS} footer={footer} />;
}

export default AdminLayout;
