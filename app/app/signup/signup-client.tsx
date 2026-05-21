'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { BRAND } from '@/lib/brand';

export default function SignupClient() {
  const router = useRouter();
  const search = useSearchParams();
  const intendedPlan = search.get('plan');

  const [fullName, setFullName] = useState('');
  const [practice, setPractice] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          practice_name: practice,
        },
        emailRedirectTo:
          typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
      },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    // If email confirmation is enabled in Supabase, session will be null.
    if (!data.session) {
      setConfirmSent(true);
      return;
    }
    router.push(intendedPlan ? `/dashboard?plan=${intendedPlan}` : '/dashboard');
    router.refresh();
  }

  async function signUpWithGoogle() {
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

  if (confirmSent) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="card max-w-sm p-8 text-center animate-pop-in">
          <div className="w-12 h-12 rounded-full bg-emerald-100 mx-auto flex items-center justify-center text-2xl">
            ✓
          </div>
          <h1 className="mt-4 text-xl font-bold">Check your email</h1>
          <p className="mt-2 text-sm text-slate-600">
            We&apos;ve sent a confirmation link to <strong>{email}</strong>.
            Click it to finish setting up your practice.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Left: marketing context */}
      <aside className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-brand-primary to-brand-accent text-white">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-lg">
          <span className="w-7 h-7 rounded-lg bg-white/20" />
          {BRAND.name}
        </Link>
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
            Save reception 5 minutes per new patient.
          </h2>
          <ul className="mt-6 space-y-2 text-indigo-100 text-sm">
            <li>· Free for your first 10 SMS forms each month</li>
            <li>· Real-time patient details inside Chrome</li>
            <li>· Set up in 5 minutes — no IT team required</li>
          </ul>
        </div>
        <p className="text-xs text-indigo-200">
          {BRAND.name} · {BRAND.domain}
        </p>
      </aside>

      {/* Right: form */}
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="flex items-center gap-2 font-extrabold tracking-tight lg:hidden mb-8 justify-center"
          >
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent" />
            {BRAND.name}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Create your practice</h1>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            Free forever for up to 10 SMS forms / month.
          </p>

          <button
            type="button"
            onClick={signUpWithGoogle}
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
            <Field label="Your name">
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </Field>
            <Field label="Practice name">
              <input
                className="input"
                value={practice}
                onChange={(e) => setPractice(e.target.value)}
                placeholder="e.g. Smile Dental"
                autoComplete="organization"
                required
              />
            </Field>
            <Field label="Work email">
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                required
              />
            </Field>

            {error && (
              <p className="text-sm text-brand-error font-medium">{error}</p>
            )}

            <button type="submit" className="btn-primary w-full !py-3" disabled={busy}>
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="text-xs text-center text-slate-500 mt-6">
            Already have an account?{' '}
            <Link href="/dashboard/login" className="text-brand-primary font-medium">
              Sign in
            </Link>
          </p>
          <p className="text-[11px] text-center text-slate-400 mt-2">
            By signing up you agree to {BRAND.name}&apos;s terms.
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7C34.3 6.2 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.3 6.2 29.4 4 24 4 16.2 4 9.4 8.7 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.3 0 10-2 13.6-5.3l-6.3-5.2C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.3 39.3 16 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.5l6.3 5.2C41 35 44 30 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
