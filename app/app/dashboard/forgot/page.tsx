'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { BRAND } from '@/lib/brand';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window !== 'undefined'
          ? `${window.location.origin}/dashboard/reset`
          : undefined,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
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

        {sent ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 mx-auto flex items-center justify-center text-2xl">
              ✓
            </div>
            <h1 className="mt-4 text-xl font-semibold">Check your email</h1>
            <p className="mt-2 text-sm text-slate-600">
              If an account exists for <strong>{email}</strong>, we&apos;ve sent a
              link to reset your password.
            </p>
            <Link
              href="/dashboard/login"
              className="mt-6 inline-block text-sm text-brand-primary font-medium"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-center">Reset your password</h1>
            <p className="text-sm text-slate-500 text-center mt-1 mb-6">
              Enter your email and we&apos;ll send you a reset link.
            </p>
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
              {error && <p className="text-sm text-brand-error font-medium">{error}</p>}
              <button className="btn-primary w-full py-3" disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send reset link'}
              </button>
            </form>
            <p className="text-xs text-center text-slate-500 mt-6">
              Remembered it?{' '}
              <Link href="/dashboard/login" className="text-brand-primary font-medium">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
