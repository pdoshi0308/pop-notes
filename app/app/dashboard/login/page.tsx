'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { BRAND } from '@/lib/brand';

const ERROR_MESSAGES: Record<string, string> = {
  no_workspace:
    'You\'re not part of a workspace yet. Ask an admin to invite you, or create a new workspace.',
  invite_expired:
    'That invitation link has expired or been revoked. Ask the admin to send a new one.',
  accept_invite_needs_session:
    'The invitation link couldn\'t sign you in. Open the original email and click the link again.',
  idle:
    'You were signed out after a long period of inactivity. Sign in again to continue.',
};

export default function DashboardLogin() {
  return (
    <Suspense fallback={null}>
      <DashboardLoginInner />
    </Suspense>
  );
}

function DashboardLoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const reasonKey = search.get('error');
  const reason = reasonKey ? ERROR_MESSAGES[reasonKey] : null;
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

  async function signInWithGoogle() {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo:
          typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
      },
    });
    if (error) setError(error.message);
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

        <h1 className="text-xl font-semibold text-center">Sign in</h1>
        <p className="text-sm text-slate-500 text-center mt-1 mb-6">
          Admin dashboard
        </p>

        {reason && (
          <p className="text-sm rounded-lg px-3 py-2 mb-4 border text-amber-800 bg-amber-50 border-amber-100">
            {reason}
          </p>
        )}

        <button
          type="button"
          onClick={signInWithGoogle}
          className="btn-secondary w-full !py-3 mb-3"
        >
          <GoogleIcon /> Continue with Google
        </button>

        <div className="flex items-center gap-3 my-4">
          <span className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400 uppercase tracking-wider">or</span>
          <span className="flex-1 h-px bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label" htmlFor="email">Email</label>
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="label !mb-0" htmlFor="password">Password</label>
              <Link
                href="/dashboard/forgot"
                className="text-xs text-brand-primary font-medium"
              >
                Forgot?
              </Link>
            </div>
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

          {error && <p className="text-sm text-brand-error font-medium">{error}</p>}

          <button className="btn-primary w-full py-3" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-center text-slate-500 mt-6">
          No account?{' '}
          <Link href="/signup" className="text-brand-primary font-medium">
            Create your account
          </Link>
        </p>
        <p className="text-[11px] text-center text-slate-400 mt-2">
          Team members can sign in here too — invites arrive by email.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7C34.3 6.2 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.3 6.2 29.4 4 24 4 16.2 4 9.4 8.7 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.3 0 10-2 13.6-5.3l-6.3-5.2C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.3 39.3 16 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.5l6.3 5.2C41 35 44 30 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
