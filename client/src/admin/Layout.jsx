import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { api } from '../lib/api.js';

/** Unread enquiries, for the badge on the Messages tab. Rechecked on every page change. */
function useUnreadCount() {
  const [count, setCount] = useState(0);
  const location = useLocation();
  useEffect(() => {
    let live = true;
    api('/api/admin/messages?status=new&limit=1')
      .then((r) => live && setCount(r.counts.new))
      .catch(() => {});
    const onChange = (e) => setCount(e.detail);
    window.addEventListener('ce:unread', onChange);
    return () => {
      live = false;
      window.removeEventListener('ce:unread', onChange);
    };
  }, [location.pathname]);
  return count;
}

const TABS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/projects', label: 'Projects' },
  { to: '/admin/awards', label: 'Awards' },
  { to: '/admin/documents', label: 'Documents' },
  { to: '/admin/messages', label: 'Messages' },
  { to: '/admin/settings', label: 'Settings' },
];

/** The header, tab bar and page body every logged-in page shares. */
export default function Layout({ heading, children }) {
  const { admin, logout } = useAuth();
  const badge = useUnreadCount();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `${heading} — Ceylon Energy Admin`;
  }, [heading]);

  return (
    <>
      <header className="admin-header">
        <div className="admin-brand">
          <img src="/assets/images/ceylon-logo-icon.png" alt="" width="40" height="40" />
          <div>
            <p className="eyebrow">Ceylon Energy Services — Admin</p>
            <h1>{heading}</h1>
          </div>
        </div>
        <div className="admin-header-actions">
          <span className="fine-print admin-who">{admin?.name || admin?.email}</span>
          <a className="btn btn-ghost" href="/" target="_blank" rel="noopener noreferrer">
            View live site
          </a>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={async () => {
              await logout();
              navigate('/admin/login');
            }}
          >
            Log out
          </button>
        </div>
      </header>
      <nav className="admin-tabs" aria-label="Admin sections">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => `admin-tab${isActive ? ' is-active' : ''}`}>
            {tab.label}
            {tab.label === 'Messages' && badge ? <span className="tab-badge">{badge}</span> : null}
          </NavLink>
        ))}
      </nav>
      <main className="admin-main">{children}</main>
    </>
  );
}
