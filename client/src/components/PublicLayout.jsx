import site from '../config/site';
import { useUserAuth } from '../hooks/useUserAuth';
import SidebarShell from './SidebarShell';

// User site: same sidebar layout as the admin panel
function PublicLayout() {
  const { isLoggedIn } = useUserAuth();

  const items = [
    { to: '/availability', label: 'Blood stock' },
    { to: '/donate', label: 'Donate' },
    { to: '/request-blood', label: 'Request blood' },
    { to: '/track', label: 'Track a request' },
    isLoggedIn
      ? { to: '/account', label: 'My account' }
      : { to: '/login', label: 'Log in' }
  ];

  return <SidebarShell brand={site.name} brandTo="/home" items={items} className="pub-shell" />;
}

export default PublicLayout;
