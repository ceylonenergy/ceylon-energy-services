import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

/**
 * First-run: create the first admin account from the browser.
 * The server only allows this while no admin exists, and only with the
 * ADMIN_SETUP_TOKEN from its environment.
 */
export default function Setup() {
  const { admin, checking, needsSetup, setupEnabled, completeSetup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ setupToken: '', name: '', email: '', password: '', password2: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Set Up Admin Access — Ceylon Energy Services';
  }, []);

  if (checking) return <div className="admin-boot">Checking…</div>;
  if (admin) return <Navigate to="/admin" replace />;
  if (!needsSetup) return <Navigate to="/admin/login" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.password2) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await completeSetup({ setupToken: form.setupToken, name: form.name, email: form.email, password: form.password });
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-auth-page">
      <div className="auth-card">
        <p className="eyebrow">Ceylon Energy Services — Admin</p>
        <h1>Create your admin account</h1>

        {!setupEnabled ? (
          <>
            <p className="lede">No admin account exists yet. For security, the first one is created on the server:</p>
            <pre className="code-block">npm run create-admin</pre>
            <p className="fine-print">
              Or, to allow setting it up here in the browser, add <code>ADMIN_SETUP_TOKEN=some-long-secret</code> to the
              server's environment, restart it, and reload this page.
            </p>
          </>
        ) : (
          <>
            <p className="lede">This is a one-time step. Enter the setup token from the server's <code>ADMIN_SETUP_TOKEN</code> setting.</p>
            {error && (
              <div className="notice notice-error" role="alert">
                {error}
              </div>
            )}
            <form onSubmit={submit} autoComplete="off">
              <label>
                Setup token
                <input type="password" required value={form.setupToken} onChange={set('setupToken')} />
              </label>
              <label>
                Your name
                <input type="text" maxLength={100} value={form.name} onChange={set('name')} />
              </label>
              <label>
                Email
                <input type="email" required autoComplete="username" value={form.email} onChange={set('email')} />
              </label>
              <label>
                Password (8+ characters)
                <input type="password" minLength={8} required autoComplete="new-password" value={form.password} onChange={set('password')} />
              </label>
              <label>
                Repeat password
                <input type="password" minLength={8} required autoComplete="new-password" value={form.password2} onChange={set('password2')} />
              </label>
              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create account & continue'}
              </button>
            </form>
            <p className="fine-print">After this, remove ADMIN_SETUP_TOKEN from the server — it is not needed again.</p>
          </>
        )}
      </div>
    </div>
  );
}
