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
  invitationId,
  alreadyInTargetWorkspace,
  currentWorkspaceId,
  needsPassword,
}: {
  email: string;
  workspaceName: string;
  role: string;
  existingName: string;
  invitationId: string;
  alreadyInTargetWorkspace: boolean;
  currentWorkspaceId: string | null;
  needsPassword: boolean;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(existingName);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | 'accept' | 'decline'>(null);
  const [error, setError] = useState<string | null>(null);

  const switchingWorkspaces =
    !!currentWorkspaceId && !alreadyInTargetWorkspace;

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    setBusy('accept');
    setError(null);
    const supabase = createSupabaseBrowserClient();

    // Consume the invitation server-side via the security-definer RPC.
    // Idempotent: if the user is already in this workspace it just
    // re-affirms the row.
    if (!alreadyInTargetWorkspace) {
      const { error: rpcErr } = await supabase.rpc('accept_invitation', {
        p_invitation_id: invitationId,
      });
      if (rpcErr) {
        setBusy(null);
        setError(rpcErr.message);
        return;
      }
    }

    if (fullName.trim() && fullName.trim() !== existingName) {
      const { data: userResult } = await supabase.auth.getUser();
      if (userResult.user) {
        await supabase
          .from('users')
          .update({ full_name: fullName.trim() })
          .eq('id', userResult.user.id);
        await supabase.auth.updateUser({
          data: { full_name: fullName.trim() },
        });
      }
    }

    // Only set a password if the user doesn't already have one (new
    // invitee). Existing accounts keep their existing password.
    if (needsPassword && password) {
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) {
        setBusy(null);
        setError(pwErr.message);
        return;
      }
    }

    setBusy(null);
    router.push('/dashboard');
    router.refresh();
  }

  async function decline() {
    if (
      !confirm(
        `Decline the invitation to ${workspaceName}? It will be removed and you can ask for a new one later.`
      )
    )
      return;
    setBusy('decline');
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: rpcErr } = await supabase.rpc('decline_invitation', {
      p_invitation_id: invitationId,
    });
    setBusy(null);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    if (currentWorkspaceId) {
      router.push('/dashboard');
    } else {
      await supabase.auth.signOut();
      router.push('/');
    }
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-brand-bg">
      <div className="w-full max-w-md card p-8 animate-pop-in">
        <div className="flex items-center gap-2 font-extrabold tracking-tight text-lg">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent" />
          {BRAND.name}
        </div>

        {alreadyInTargetWorkspace ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight mt-6">
              You&apos;re already in {workspaceName}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              No further action needed. Head back to the dashboard.
            </p>
            <button
              className="btn-primary w-full !py-3 mt-6"
              onClick={() => {
                router.push('/dashboard');
                router.refresh();
              }}
            >
              Open dashboard
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight mt-6">
              {switchingWorkspaces
                ? `Join ${workspaceName}?`
                : `Welcome to ${workspaceName}`}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              You&apos;ve been invited as{' '}
              {role === 'admin' ? 'an admin' : 'a team member'}.
              {switchingWorkspaces && (
                <>
                  {' '}
                  Accepting will move your {BRAND.name} account into this
                  workspace and you&apos;ll leave your current one.
                </>
              )}
              {!switchingWorkspaces && needsPassword && (
                <> Finish setting up your account so you can sign in next time.</>
              )}
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
              {needsPassword && (
                <div>
                  <label className="label">Set a password</label>
                  <input
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    autoComplete="new-password"
                    required={needsPassword}
                  />
                </div>
              )}
              {error && (
                <p className="text-sm text-brand-error font-medium">{error}</p>
              )}
              <button className="btn-primary w-full !py-3" disabled={busy !== null}>
                {busy === 'accept' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : switchingWorkspaces ? (
                  'Join workspace'
                ) : (
                  'Finish & open dashboard'
                )}
              </button>
              <button
                type="button"
                className="btn-secondary w-full !py-3 !text-rose-700 !border-rose-200 hover:!bg-rose-50"
                onClick={decline}
                disabled={busy !== null}
              >
                {busy === 'decline' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Decline invitation'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
