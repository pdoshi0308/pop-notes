'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { BRAND } from '@/lib/brand';

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  // Supabase turns the recovery link into a session once the SDK processes the
  // URL hash. Wait for that session before letting the user set a password.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 1200);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-brand-bg">
      <div className="card w-full max-w-sm p-7 animate-pop-in">
        <Link
          href="/"
          className="flex items-center gap-2 font-extrabold text-lg tracking-tight mb-6 justify-center"
        >
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent" />
          {BRAND.name}
        </Link>

        {done ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 mx-auto flex items-center justify-center text-2xl">
              ✓
            </div>
            <h1 className="mt-4 text-xl font-semibold">Password updated</h1>
            <p className="mt-2 text-sm text-slate-600">Signing you in…</p>
          </div>
        ) : !ready ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-600">
              This reset link is invalid or has expired.
            </p>
            <Link
              href="/dashboard/forgot"
              className="mt-4 inline-block text-sm text-brand-primary font-medium"
            >
              Request a new link
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-center">Choose a new password</h1>
            <p className="text-sm text-slate-500 text-center mt-1 mb-6">
              Make it at least 6 characters.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="label" htmlFor="password">New password</label>
                <input
                  id="password"
                  type="password"
                  className="input"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="confirm">Confirm password</label>
                <input
                  id="confirm"
                  type="password"
                  className="input"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-brand-error font-medium">{error}</p>}
              <button className="btn-primary w-full py-3" disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
