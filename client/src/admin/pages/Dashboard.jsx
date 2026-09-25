import { Link } from 'react-router-dom';
import Layout from '../Layout.jsx';
import { Notice } from '../ui.jsx';
import { useApi } from '../../lib/useApi.js';

function Stat({ to, value, label }) {
  return (
    <Link to={to} className="stat-card">
      <b>{value}</b>
      <span>{label}</span>
    </Link>
  );
}

function StatusRow({ ok, label, children }) {
  return (
    <li className="status-row">
      <span className={`dot ${ok ? 'dot-ok' : 'dot-warn'}`} aria-hidden="true" />
      <span className="status-label">{label}</span>
      <span className="status-detail">{children}</span>
    </li>
  );
}

export default function Dashboard() {
  const { data, error, loading } = useApi('/api/admin/stats');
  const c = data?.counts;
  const s = data?.system;

  return (
    <Layout heading="Dashboard">
      <Notice notice={error ? { type: 'error', text: error.message } : null} />
      {loading && <p className="muted">Loading…</p>}

      {c && (
        <>
          <section className="stat-grid" aria-label="Website content">
            <Stat to="/admin/projects" value={c.locations} label={c.locations === 1 ? 'location' : 'locations'} />
            <Stat to="/admin/projects" value={c.projects} label={c.projects === 1 ? 'project' : 'projects'} />
            <Stat to="/admin/projects" value={c.photos} label={c.photos === 1 ? 'photo' : 'photos'} />
            <Stat to="/admin/awards" value={c.awards} label={c.awards === 1 ? 'award' : 'awards'} />
            <Stat to="/admin/documents" value={c.profilePages} label="profile pages" />
            <Stat to="/admin/messages" value={c.newMessages} label={c.newMessages === 1 ? 'new message' : 'new messages'} />
          </section>

          {c.newMessages > 0 && (
            <div className="notice notice-ok">
              You have {c.newMessages} unread {c.newMessages === 1 ? 'enquiry' : 'enquiries'}.{' '}
              <Link to="/admin/messages">Read {c.newMessages === 1 ? 'it' : 'them'} →</Link>
            </div>
          )}

          <section className="admin-card">
            <h2>System status</h2>
            <ul className="status-list">
              <StatusRow ok={s.mongo === 'connected'} label="Database">
                MongoDB Atlas is {s.mongo}.
              </StatusRow>
              <StatusRow ok label="Image storage">
                {s.storage === 'cloudinary'
                  ? 'Cloudinary — photos are resized and optimised automatically.'
                  : 'MongoDB GridFS. Works fine; add Cloudinary credentials for automatic resizing and a faster CDN.'}
              </StatusRow>
              <StatusRow ok={s.mail !== 'disabled'} label="Contact email">
                {s.mail === 'smtp' && <>Enquiries are emailed to {s.mailTo.join(', ')} and saved under Messages.</>}
                {s.mail === 'console' && <>Development mode: emails are printed in the server terminal, not sent.</>}
                {s.mail === 'disabled' && (
                  <>
                    Not configured — enquiries are saved under Messages but <b>not emailed</b>. Set <code>SMTP_HOST</code>,{' '}
                    <code>SMTP_USER</code> and <code>SMTP_PASS</code> on the server to turn email on.
                  </>
                )}
              </StatusRow>
            </ul>
          </section>

          <section className="admin-card">
            <h2>Quick actions</h2>
            <div className="quick-actions">
              <Link className="btn btn-ghost" to="/admin/projects">
                Add project photos
              </Link>
              <Link className="btn btn-ghost" to="/admin/awards">
                Add an award
              </Link>
              <Link className="btn btn-ghost" to="/admin/documents">
                Update the company profile
              </Link>
            </div>
          </section>
        </>
      )}
    </Layout>
  );
}
