'use client';

import { useState } from 'react';
import { Loader2, Mail, Trash2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface Member {
  id: string;
  full_name: string;
  role: string;
}

export default function TeamPanel({
  workspaceId,
  currentUserId,
  isAdmin,
  members,
}: {
  workspaceId: string;
  currentUserId: string;
  isAdmin: boolean;
  members: Member[];
}) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'receptionist'>('receptionist');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setBusy(true);
    setNote(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: inviteEmail,
      options: {
        emailRedirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}/dashboard`
            : undefined,
      },
    });
    setBusy(false);
    if (error) {
      setNote(error.message);
      return;
    }
    setNote(
      `Magic link sent to ${inviteEmail}. After they accept, add their row to the users table with workspace ${workspaceId} and role ${inviteRole}.`
    );
    setInviteEmail('');
  }

  async function remove(memberId: string) {
    if (!confirm('Remove this user from the workspace?')) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('users')
      .update({ workspace_id: null })
      .eq('id', memberId);
    if (error) alert(error.message);
    else location.reload();
  }

  return (
    <div className="px-8 py-10 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Team</h1>
      <p className="text-slate-600 mt-1">
        Invite receptionists so they can sign into the Chrome extension.
      </p>

      {isAdmin && (
        <form
          onSubmit={sendInvite}
          className="card p-5 mt-8 grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end"
        >
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="receptionist@yourpractice.co.uk"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select
              className="input"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'receptionist')}
            >
              <option value="receptionist">Receptionist</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button className="btn-primary py-3" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><Mail className="w-4 h-4" /> Send invite</>)}
          </button>
        </form>
      )}

      {note && (
        <p className="text-sm text-slate-600 mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {note}
        </p>
      )}

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-10 mb-3">
        Members
      </h2>
      <ul className="card divide-y divide-slate-100">
        {members.map((m) => (
          <li key={m.id} className="px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">
              {m.full_name.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {m.full_name} {m.id === currentUserId && <span className="text-xs text-slate-400">(you)</span>}
              </p>
              <p className="text-xs text-slate-500 capitalize">{m.role}</p>
            </div>
            {isAdmin && m.id !== currentUserId && (
              <button
                className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-brand-error transition"
                onClick={() => remove(m.id)}
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
