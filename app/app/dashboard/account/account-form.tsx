'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertTriangle } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { Notice, type NoticeState } from '../components/notice';

export default function AccountForm({
  email: initialEmail,
  fullName: initialName,
  role,
  workspaceName,
  hasPassword,
}: {
  email: string;
  fullName: string;
  role: string;
  workspaceName: string;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameNote, setNameNote] = useState<NoticeState>(null);

  const [newEmail, setNewEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNote, setEmailNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwNote, setPwNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [dangerBusy, setDangerBusy] = useState<null | 'leave' | 'delete' | 'workspace'>(null);
  const [confirmWs, setConfirmWs] = useState('');
  const [dangerNote, setDangerNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function getToken(): Promise<string | null> {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function saveName() {
    setSavingName(true);
    setNameSaved(false);
    setNameNote(null);
    const token = await getToken();
    const res = await fetch('/api/account', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ full_name: name }),
    });
    setSavingName(false);
    if (res.ok) {
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 1800);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setNameNote({ kind: 'err', text: data.error ?? 'Could not save' });
    }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailBusy(true);
    setEmailNote(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailBusy(false);
    if (error) {
      setEmailNote({ kind: 'err', text: error.message });
      return;
    }
    setEmailNote({
      kind: 'ok',
      text: `We've sent a confirmation link to ${newEmail}. Click it to finish the change.`,
    });
    setNewEmail('');
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwBusy(true);
    setPwNote(null);
    const supabase = createSupabaseBrowserClient();
    // If the user already has a password identity, re-auth with the current
    // one first — that way a stolen session token alone can't change the
    // password. OAuth-only users skip the re-auth (there's no current
    // password to check against) and simply set one for the first time.
    if (hasPassword) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: initialEmail,
        password: currentPw,
      });
      if (signInErr) {
        setPwBusy(false);
        setPwNote({ kind: 'err', text: 'Current password is incorrect' });
        return;
      }
    }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwBusy(false);
    if (error) {
      setPwNote({ kind: 'err', text: error.message });
      return;
    }
    setPwNote({
      kind: 'ok',
      text: hasPassword
        ? 'Password updated.'
        : 'Password set. You can now sign in with email + password — including from the Chrome extension.',
    });
    setCurrentPw('');
    setNewPw('');
    router.refresh();
  }

  async function leaveWorkspace() {
    if (!confirm('Leave this workspace? You will need to be re-invited to come back.')) return;
    setDangerBusy('leave');
    const token = await getToken();
    const res = await fetch('/api/account/leave', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    setDangerBusy(null);
    if (!res.ok || !data.ok) {
      setDangerNote({ kind: 'err', text: data.error ?? 'Could not leave' });
      return;
    }
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/dashboard/login');
  }

  async function deleteAccount() {
    if (
      !confirm(
        'Delete your account permanently? This cannot be undone. Your workspace data will remain if other members are still in it.'
      )
    )
      return;
    setDangerBusy('delete');
    const token = await getToken();
    const res = await fetch('/api/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    setDangerBusy(null);
    if (!res.ok || !data.ok) {
      setDangerNote({ kind: 'err', text: data.error ?? 'Could not delete' });
      return;
    }
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  async function deleteWorkspace() {
    setDangerBusy('workspace');
    setDangerNote(null);
    const token = await getToken();
    const res = await fetch('/api/workspace/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ confirm_name: confirmWs }),
    });
    const data = await res.json().catch(() => ({}));
    setDangerBusy(null);
    if (!res.ok || !data.ok) {
      setDangerNote({ kind: 'err', text: data.error ?? 'Could not delete workspace' });
      return;
    }
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  const isAdmin = role === 'admin';

  return (
    <div className="px-8 py-10 max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Account</h1>
      <p className="text-slate-600 mt-1">
        Update your profile, sign-in details, and (carefully) close your account.
      </p>

      {/* Profile */}
      <section className="mt-10">
        <h2 className="text-base font-semibold">Profile</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Your name appears in the sidebar and on team rosters.
        </p>
        <div className="card p-5 mt-3 space-y-4">
          <div>
            <label className="label">Full name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {nameNote && <Notice note={nameNote} />}
          <div className="flex items-center gap-3">
            {nameSaved && (
              <span className="text-sm text-brand-success font-medium animate-fade-in">
                Saved
              </span>
            )}
            <button
              className="btn-primary ml-auto"
              onClick={saveName}
              disabled={savingName || !name.trim() || name === initialName}
            >
              {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save name'}
            </button>
          </div>
        </div>
      </section>

      {/* Email */}
      <section className="mt-10">
        <h2 className="text-base font-semibold">Email</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Used to sign in. Changing it requires confirming the new address.
        </p>
        <div className="card p-5 mt-3 space-y-4">
          <div>
            <label className="label">Current email</label>
            <input className="input" value={initialEmail} disabled />
          </div>
          <form onSubmit={changeEmail} className="space-y-3">
            <div>
              <label className="label">New email</label>
              <input
                type="email"
                className="input"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@new-address.com"
              />
            </div>
            {emailNote && (
              <p
                className={[
                  'text-sm rounded-lg px-3 py-2 border',
                  emailNote.kind === 'ok'
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                    : 'text-rose-700 bg-rose-50 border-rose-100',
                ].join(' ')}
              >
                {emailNote.text}
              </p>
            )}
            <button className="btn-primary" disabled={emailBusy || !newEmail}>
              {emailBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Send confirmation'
              )}
            </button>
          </form>
        </div>
      </section>

      {/* Password */}
      <section className="mt-10">
        <h2 className="text-base font-semibold">Password</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {hasPassword
            ? 'Use a strong, unique password. We re-check your current password before changing it.'
            : 'You signed in with Google, so no password is set. Add one so you can sign in with email + password (required by the Chrome extension).'}
        </p>
        <div className="card p-5 mt-3">
          <form onSubmit={changePassword} className="space-y-3">
            {hasPassword && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label !mb-0">Current password</label>
                  <Link
                    href="/dashboard/forgot"
                    className="text-xs text-brand-primary font-medium"
                  >
                    Forgot?
                  </Link>
                </div>
                <input
                  type="password"
                  className="input"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            )}
            <div>
              <label className="label">
                {hasPassword ? 'New password' : 'Choose a password'}
              </label>
              <input
                type="password"
                className="input"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                required
              />
            </div>
            {pwNote && (
              <p
                className={[
                  'text-sm rounded-lg px-3 py-2 border',
                  pwNote.kind === 'ok'
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                    : 'text-rose-700 bg-rose-50 border-rose-100',
                ].join(' ')}
              >
                {pwNote.text}
              </p>
            )}
            <button
              className="btn-primary"
              disabled={pwBusy || (hasPassword && !currentPw) || !newPw}
            >
              {pwBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : hasPassword ? (
                'Change password'
              ) : (
                'Set password'
              )}
            </button>
          </form>
        </div>
      </section>

      {/* Danger zone */}
      <section className="mt-10">
        <h2 className="text-base font-semibold text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Danger zone
        </h2>
        <div className="card p-5 mt-3 border-rose-100 space-y-5">
          {!isAdmin && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Leave this workspace</p>
                <p className="text-xs text-slate-500">
                  Removes you from {workspaceName}. You keep your account and can be re-invited later.
                </p>
              </div>
              <button
                className="btn-secondary !text-rose-700 !border-rose-200 hover:!bg-rose-50"
                onClick={leaveWorkspace}
                disabled={dangerBusy === 'leave'}
              >
                {dangerBusy === 'leave' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Leave workspace'
                )}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Delete my account</p>
              <p className="text-xs text-slate-500">
                Permanently removes your sign-in. The workspace itself is preserved if other admins remain.
              </p>
            </div>
            <button
              className="btn-secondary !text-rose-700 !border-rose-200 hover:!bg-rose-50"
              onClick={deleteAccount}
              disabled={dangerBusy === 'delete'}
            >
              {dangerBusy === 'delete' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Delete account'
              )}
            </button>
          </div>

          {isAdmin && (
            <div className="border-t border-rose-100 pt-5">
              <p className="font-medium text-rose-700">Delete the entire workspace</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Cancels your subscription, removes every member, every form, and every submission. Cannot be undone.
              </p>
              <div className="mt-3 grid sm:grid-cols-[1fr_auto] gap-2">
                <input
                  className="input"
                  placeholder={`Type "${workspaceName}" to confirm`}
                  value={confirmWs}
                  onChange={(e) => setConfirmWs(e.target.value)}
                />
                <button
                  className="btn-primary !bg-rose-600 hover:!bg-rose-700"
                  onClick={deleteWorkspace}
                  disabled={
                    dangerBusy === 'workspace' ||
                    confirmWs.trim().toLowerCase() !== workspaceName.toLowerCase()
                  }
                >
                  {dangerBusy === 'workspace' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Delete workspace'
                  )}
                </button>
              </div>
            </div>
          )}

          {dangerNote && (
            <p
              className={[
                'text-sm rounded-lg px-3 py-2 border',
                dangerNote.kind === 'ok'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                  : 'text-rose-700 bg-rose-50 border-rose-100',
              ].join(' ')}
            >
              {dangerNote.text}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
