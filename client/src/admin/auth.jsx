import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

/**
 * Who is logged in. The session itself is an httpOnly cookie the
 * browser manages; this only asks the server "who am I?" and keeps the
 * answer for the UI.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ admin: null, checking: true, needsSetup: false, setupEnabled: false });

  const refresh = useCallback(async () => {
    const { admin } = await api('/api/auth/me').catch(() => ({ admin: null }));
    if (admin) {
      setState({ admin, checking: false, needsSetup: false, setupEnabled: false });
      return;
    }
    const status = await api('/api/auth/setup-status').catch(() => ({ needsSetup: false, setupEnabled: false }));
    setState({ admin: null, checking: false, needsSetup: status.needsSetup, setupEnabled: status.setupEnabled });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const { admin } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    setState((s) => ({ ...s, admin, needsSetup: false }));
    return admin;
  }, []);

  const completeSetup = useCallback(async (body) => {
    const { admin } = await api('/api/auth/setup', { method: 'POST', body });
    setState((s) => ({ ...s, admin, needsSetup: false }));
    return admin;
  }, []);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setState((s) => ({ ...s, admin: null }));
  }, []);

  /** Called when any request comes back 401 (session expired elsewhere). */
  const sessionEnded = useCallback(() => setState((s) => ({ ...s, admin: null })), []);

  return (
    <AuthContext.Provider value={{ ...state, refresh, login, logout, completeSetup, sessionEnded }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
