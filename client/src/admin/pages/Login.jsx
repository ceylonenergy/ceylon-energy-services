import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { admin, checking, needsSetup, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Admin Login — Ceylon Energy Services';
  }, []);

  if (checking) return <div className="admin-boot">Checking your session…</div>;
  if (admin) return <Navigate to={location.state?.from || '/admin'} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate(location.state?.from || '/admin', { replace: true });
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-auth-page">
      <div className="auth-card">
        <img className="auth-logo" src="/assets/images/ceylon-logo-full.png" alt="Ceylon Energy Services" />
        <p className="eyebrow">Ceylon Energy Services — Admin</p>
        <h1>Admin Login</h1>
        <p className="lede">Log in to update the projects, awards, documents and messages on the website.</p>

        {needsSetup && (
          <div className="notice notice-ok">
            No admin account exists yet. <Link to="/admin/setup">Set one up first →</Link>
          </div>
        )}
        {error && (
          <div className="notice notice-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <label>
            Email
            <input type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Logging in…' : 'Log In'}
          </button>
        </form>
        <p className="fine-print">
          Forgot your password? Someone with server access can reset it with{' '}
          <code>npm run create-admin -- --email you@example.com --reset</code>
        </p>
        <p className="fine-print">
          <a href="/">← Back to website</a>
        </p>
      </div>
    </div>
  );
}
