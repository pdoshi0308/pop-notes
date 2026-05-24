'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { BRAND } from '@/lib/brand';

export default function AcceptInviteForm({
  email,
  workspaceName,
  role,
  existingName,
}: {
  email: string;
  workspaceName: string;
  role: string;
  existingName: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(existingName);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    // Save full_name to public.users so the dashboard shows it everywhere.
    if (fullName.trim()) {
      const { data: userResult } = await supabase.auth.getUser();
      if (userResult.user) {
        await supabase
          .from('users')
          .update({ full_name: fullName.trim() })
          .eq('id', userResult.user.id);
      }
    }

    // Set a password so they don't need to use a magic link every time.
    const { error: pwErr } = await supabase.auth.updateUser({
      password,
      data: { full_name: fullName.trim() || undefined },
    });
    setBusy(false);
    if (pwErr) {
      setError(pwErr.message);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-brand-bg">
      <div className="w-full max-w-md card p-8 animate-pop-in">
        <div className="flex items-center gap-2 font-extrabold tracking-tight text-lg">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent" />
          {BRAND.name}
        </div>
        <h1 className="text-2xl font-bold tracking-tight mt-6">
          Welcome to {workspaceName}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          You&apos;ve been added as a {role === 'admin' ? 'an admin' : 'team member'}.
          Finish setting up your account so you can sign in next time.
        </p>

        <form onSubmit={finish} className="mt-6 space-y-3">
          <div>
            <label className="label">Email</label>
            <input className="input" value={email} disabled />
          </div>
          <div>
            <label className="label">Your name</label>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label className="label">Set a password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              required
            />
          </div>
          {error && <p className="text-sm text-brand-error font-medium">{error}</p>}
          <button className="btn-primary w-full !py-3" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Finish & open dashboard'}
          </button>
        </form>
      </div>
    </main>
  );
}
