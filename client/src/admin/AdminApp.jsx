import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import '../styles/admin.css';
import { AuthProvider, useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Setup from './pages/Setup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Projects from './pages/Projects.jsx';
import Awards from './pages/Awards.jsx';
import Documents from './pages/Documents.jsx';
import Messages from './pages/Messages.jsx';
import Settings from './pages/Settings.jsx';

/** Pages behind the login. Sends visitors to setup or login as needed. */
function Protected({ children }) {
  const { admin, checking, needsSetup } = useAuth();
  const location = useLocation();
  if (checking) return <div className="admin-boot">Checking your session…</div>;
  if (!admin) {
    return <Navigate to={needsSetup ? '/admin/setup' : '/admin/login'} replace state={{ from: location.pathname }} />;
  }
  return children;
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="setup" element={<Setup />} />
        <Route index element={<Protected><Dashboard /></Protected>} />
        <Route path="projects" element={<Protected><Projects /></Protected>} />
        <Route path="awards" element={<Protected><Awards /></Protected>} />
        <Route path="documents" element={<Protected><Documents /></Protected>} />
        <Route path="messages" element={<Protected><Messages /></Protected>} />
        <Route path="settings" element={<Protected><Settings /></Protected>} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AuthProvider>
  );
}
