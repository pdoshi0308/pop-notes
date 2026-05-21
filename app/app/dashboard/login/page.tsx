'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function DashboardLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-brand-bg">
      <div className="card w-full max-w-sm p-7 animate-pop-in">
        <div className="flex items-center gap-2 font-extrabold text-lg tracking-tight mb-6 justify-center">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent" />
          Popform
        </div>

        <h1 className="text-xl font-semibold text-center">Sign in</h1>
        <p className="text-sm text-slate-500 text-center mt-1 mb-6">
          Practice admin dashboard
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-brand-error font-medium">{error}</p>
          )}

          <button className="btn-primary w-full py-3" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-center text-slate-400 mt-6">
          Receptionists sign in through the Chrome extension.
        </p>
      </div>
    </main>
  );
}
