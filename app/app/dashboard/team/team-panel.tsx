'use client';

import { useState } from 'react';
import { Loader2, Mail, Trash2, RotateCw, Clock } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface Member {
  id: string;
  full_name: string;
  role: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
}

export default function TeamPanel({
  workspaceId,
  currentUserId,
  isAdmin,
  members,
  invitations,
}: {
  workspaceId: string;
  currentUserId: string;
  isAdmin: boolean;
  members: Member[];
  invitations: Invitation[];
}) {
  void workspaceId;
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'receptionist'>('receptionist');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [pendingRow, setPendingRow] = useState<string | null>(null);

  async function getToken(): Promise<string | null> {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setBusy(true);
    setNote(null);
    const token = await getToken();
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok || !data.ok) {
      setNote({ kind: 'err', text: data.error ?? 'Could not send invite' });
      return;
    }
    setNote({
      kind: 'ok',
      text: `Invite sent to ${inviteEmail}. They have 7 days to accept.`,
    });
    setInviteEmail('');
    location.reload();
  }

  async function resend(inv: Invitation) {
    setPendingRow(inv.id);
    const token = await getToken();
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email: inv.email, role: inv.role }),
    });
    const data = await res.json();
    setPendingRow(null);
    if (!res.ok || !data.ok) {
      setNote({ kind: 'err', text: data.error ?? 'Could not resend' });
      return;
    }
    setNote({ kind: 'ok', text: `Invite re-sent to ${inv.email}.` });
    location.reload();
  }

  async function revoke(inv: Invitation) {
    if (!confirm(`Revoke the invitation for ${inv.email}?`)) return;
    setPendingRow(inv.id);
    const token = await getToken();
    const res = await fetch('/api/team/invite', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: inv.id }),
    });
    const data = await res.json();
    setPendingRow(null);
    if (!res.ok || !data.ok) {
      setNote({ kind: 'err', text: data.error ?? 'Could not revoke' });
      return;
    }
    location.reload();
  }

  async function changeRole(member: Member, role: 'admin' | 'receptionist') {
    if (member.role === role) return;
    setPendingRow(member.id);
    const token = await getToken();
    const res = await fetch('/api/team/role', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: member.id, role }),
    });
    const data = await res.json();
    setPendingRow(null);
    if (!res.ok || !data.ok) {
      setNote({ kind: 'err', text: data.error ?? 'Could not change role' });
      return;
    }
    location.reload();
  }

  async function remove(member: Member) {
    if (!confirm(`Remove ${member.full_name} from the workspace?`)) return;
    setPendingRow(member.id);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('users')
      .update({ workspace_id: null })
      .eq('id', member.id);
    setPendingRow(null);
    if (error) {
      setNote({ kind: 'err', text: error.message });
      return;
    }
    location.reload();
  }

  return (
    <div className="px-8 py-10 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Team</h1>
      <p className="text-slate-600 mt-1">
        Invite team members so they can sign into the Chrome extension and dashboard.
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
              placeholder="teammate@yourbusiness.co.uk"
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
              <option value="receptionist">Team member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button className="btn-primary py-3" disabled={busy}>
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Mail className="w-4 h-4" /> Send invite
              </>
            )}
          </button>
        </form>
      )}

      {note && (
        <p
          className={[
            'text-sm mt-3 rounded-lg px-3 py-2 border',
            note.kind === 'ok'
              ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
              : 'text-rose-700 bg-rose-50 border-rose-100',
          ].join(' ')}
        >
          {note.text}
        </p>
      )}

      {invitations.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-10 mb-3">
            Pending invites
          </h2>
          <ul className="card divide-y divide-slate-100">
            {invitations.map((inv) => {
              const busyRow = pendingRow === inv.id;
              return (
                <li key={inv.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{inv.email}</p>
                    <p className="text-xs text-slate-500 capitalize">
                      {inv.role} · invited {relTime(inv.created_at)} · expires {relTime(inv.expires_at)}
                    </p>
                  </div>
                  {isAdmin && (
                    <>
                      <button
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-50 transition disabled:opacity-50"
                        onClick={() => resend(inv)}
                        disabled={busyRow}
                        title="Resend"
                      >
                        {busyRow ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCw className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-brand-error transition disabled:opacity-50"
                        onClick={() => revoke(inv)}
                        disabled={busyRow}
                        title="Revoke"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-10 mb-3">
        Members
      </h2>
      <ul className="card divide-y divide-slate-100">
        {members.map((m) => {
          const busyRow = pendingRow === m.id;
          const isSelf = m.id === currentUserId;
          return (
            <li key={m.id} className="px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">
                {m.full_name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {m.full_name}{' '}
                  {isSelf && <span className="text-xs text-slate-400">(you)</span>}
                </p>
                <p className="text-xs text-slate-500 capitalize">{m.role}</p>
              </div>
              {isAdmin && !isSelf && (
                <>
                  <select
                    className="input !py-1.5 !text-xs w-32"
                    value={m.role}
                    onChange={(e) =>
                      changeRole(m, e.target.value as 'admin' | 'receptionist')
                    }
                    disabled={busyRow}
                  >
                    <option value="receptionist">Team member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-brand-error transition disabled:opacity-50"
                    onClick={() => remove(m)}
                    disabled={busyRow}
                    title="Remove"
                  >
                    {busyRow ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function relTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const day = 24 * 3600 * 1000;
  const hour = 3600 * 1000;
  const min = 60 * 1000;
  let value: number;
  let unit: string;
  if (abs >= day) {
    value = Math.round(abs / day);
    unit = value === 1 ? 'day' : 'days';
  } else if (abs >= hour) {
    value = Math.round(abs / hour);
    unit = value === 1 ? 'hour' : 'hours';
  } else {
    value = Math.max(1, Math.round(abs / min));
    unit = value === 1 ? 'minute' : 'minutes';
  }
  return diff < 0 ? `${value} ${unit} ago` : `in ${value} ${unit}`;
}
