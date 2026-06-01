import React from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './client.js';

/* Auth context — wraps the app, exposes the current user + login/logout.
   JWT only for now; the server hides a pluggable provider behind /api/auth. */

const AuthCtx = React.createContext(null);
export const useAuth = () => React.useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [me, setMe] = React.useState(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setUnauthorizedHandler(() => setMe(null));
    const t = getToken();
    if (!t) { setReady(true); return; }
    api.get('/auth/me')
      .then(setMe)
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setToken(res.token);
    setMe(res.user || (await api.get('/auth/me')));
    return res;
  };
  const logout = () => { setToken(null); setMe(null); };

  return (
    <AuthCtx.Provider value={{ me, ready, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

/* Login screen — themed, centered card. Pre-fills the demo account. */
export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = React.useState('m.weber@group.eu');
  const [password, setPassword] = React.useState('demo1234');
  const [err, setErr] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await login(email.trim(), password); }
    catch { setErr('Invalid email or password.'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: 'var(--bg)', color: 'var(--text)', padding: 24,
    }}>
      <form onSubmit={submit} style={{
        width: 360, maxWidth: '90vw', background: 'var(--bg-elevated, var(--bg-muted))',
        border: '1px solid var(--border, #2a2a2a)', borderRadius: 12, padding: 28,
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
      }}>
        <div style={{ fontSize: 13, letterSpacing: 1, textTransform: 'uppercase',
                      color: 'var(--text-tertiary)', marginBottom: 6 }}>DLPE-Group</div>
        <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Intelligence Layer</h1>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 22 }}>
          Sign in to your fleet-operations console.
        </div>

        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoFocus
          style={inp} />

        <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 14, display: 'block' }}>Password</label>
        <input value={password} onChange={e => setPassword(e.target.value)} type="password"
          style={inp} />

        {err && <div style={{ color: 'var(--track-finance, #e05) ', fontSize: 12, marginTop: 12 }}>{err}</div>}

        <button type="submit" className="cta" disabled={busy}
          style={{ width: '100%', marginTop: 20, justifyContent: 'center' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 16, textAlign: 'center' }}>
          Demo · m.weber@group.eu / demo1234
        </div>
      </form>
    </div>
  );
}

const inp = {
  width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--border, #333)', background: 'var(--bg, #111)',
  color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
};
