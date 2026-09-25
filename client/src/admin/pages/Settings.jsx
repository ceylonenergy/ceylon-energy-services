import { useCallback, useEffect, useState } from 'react';
import Layout from '../Layout.jsx';
import { ConfirmButton, Notice, formatDate, useNotice } from '../ui.jsx';
import { api } from '../../lib/api.js';

export default function Settings() {
  const [users, setUsers] = useState(null);
  const { notice, setNotice, run, clear, busy } = useNotice();

  const loadUsers = useCallback(
    () =>
      api('/api/admin/users')
        .then((r) => setUsers(r.users))
        .catch((err) => setNotice({ type: 'error', text: err.message })),
    [setNotice]
  );
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function changePassword(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const { currentPassword, newPassword, newPassword2 } = Object.fromEntries(new FormData(form));
    if (newPassword !== newPassword2) {
      setNotice({ type: 'error', text: 'The two new passwords do not match.' });
      return;
    }
    const ok = await run(
      () => api('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
      'Password changed. Any other browser logged in to this account has been signed out.'
    );
    if (ok) form.reset();
  }

  async function addUser(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    const ok = await run(() => api('/api/admin/users', { method: 'POST', body }), `Account created for ${body.email}. Share the password with them securely.`);
    if (ok) {
      form.reset();
      loadUsers();
    }
  }

  return (
    <Layout heading="Settings">
      <Notice notice={notice} onDismiss={clear} />

      <section className="admin-card">
        <h2>Change your password</h2>
        <form onSubmit={changePassword} autoComplete="off">
          <label>
            Current password <input type="password" name="currentPassword" autoComplete="current-password" required />
          </label>
          <label>
            New password (8+ characters) <input type="password" name="newPassword" minLength={8} autoComplete="new-password" required />
          </label>
          <label>
            Repeat new password <input type="password" name="newPassword2" minLength={8} autoComplete="new-password" required />
          </label>
          <button className="btn" type="submit" disabled={busy}>
            Update Password
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Admin accounts</h2>
        <p className="muted">Everyone who can manage the website. Give each person their own login rather than sharing one.</p>
        {!users && <p className="muted">Loading…</p>}
        <ul className="attachment-list">
          {users?.map((u) => (
            <li key={u.id} className="attachment-item">
              <div>
                <strong>{u.name || u.email}</strong> {u.isYou && <span className="pill pill-ok">You</span>}
                <div className="fine-print">
                  {u.email} · {u.lastLoginAt ? `last login ${formatDate(u.lastLoginAt, { time: true })}` : 'never logged in'}
                </div>
              </div>
              {!u.isYou && users.length > 1 && (
                <div className="attachment-item-actions">
                  <ConfirmButton
                    message={`Remove ${u.email}'s admin access?`}
                    onConfirm={async () => {
                      if (await run(() => api(`/api/admin/users/${u.id}`, { method: 'DELETE' }), 'Account removed.')) loadUsers();
                    }}
                  >
                    Remove
                  </ConfirmButton>
                </div>
              )}
            </li>
          ))}
        </ul>

        <h3 className="subheading">Add an admin</h3>
        <form onSubmit={addUser} autoComplete="off">
          <label>
            Name <input type="text" name="name" maxLength={100} />
          </label>
          <label>
            Email <input type="email" name="email" required autoComplete="off" />
          </label>
          <label>
            Password (8+ characters) <input type="password" name="password" minLength={8} required autoComplete="new-password" />
          </label>
          <button className="btn btn-ghost" type="submit" disabled={busy}>
            Create Account
          </button>
        </form>
      </section>
    </Layout>
  );
}
