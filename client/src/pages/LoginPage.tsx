import { FormEvent, useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login, mockMode } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="text-center">
          <div className="text-5xl">🎲</div>
          <h1 className="mt-2 text-2xl font-black">StayGames</h1>
          <p className="text-sm text-slate-400">Sign in with your directory (LDAP) account</p>
        </div>
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input
            id="username"
            className="input"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <div className="rounded-xl bg-rose-500/15 p-2 text-sm text-rose-300">{error}</div>}
        <button type="submit" className="btn-primary w-full" disabled={busy || !username || !password}>
          <LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {mockMode && (
          <p className="text-center text-xs text-amber-300/80">LDAP mock mode is active.</p>
        )}
      </form>
    </div>
  );
}
