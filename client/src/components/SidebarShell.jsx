import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { List, X } from '@phosphor-icons/react';

// Sidebar + top bar + content panel shared by the admin panel and the user site.
// Styles live in admin.css (.admin-shell).
function SidebarShell({ brand, brandTo, items, footer, className = '' }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  const current = items.find((item) => (
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  ));

  return (
    <div className={`app-shell admin-shell ${className}`}>
      {menuOpen && <div className="admin-scrim" onClick={() => setMenuOpen(false)} />}

      <aside className={`admin-sidebar${menuOpen ? ' open' : ''}`}>
        <NavLink to={brandTo} className="admin-brand">{brand}</NavLink>

        <nav className="admin-nav" aria-label="Main">
          {items.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
            >
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {footer}
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <List size={20} />}
          </button>
          <span className="admin-crumb">{current?.label || brand}</span>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default SidebarShell;
