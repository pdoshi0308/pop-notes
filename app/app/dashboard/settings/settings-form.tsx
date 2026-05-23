'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface Workspace {
  id: string;
  name: string;
}

export default function SettingsForm({
  workspace,
  canEdit,
}: {
  workspace: Workspace;
  canEdit: boolean;
}) {
  const [name, setName] = useState(workspace.name);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!canEdit) return;
    setBusy(true);
    setSaved(false);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('workspaces')
      .update({ name })
      .eq('id', workspace.id);
    setBusy(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } else {
      alert(error.message);
    }
  }

  return (
    <div className="px-8 py-10 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-slate-600 mt-1">Manage your business profile.</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-brand-success font-medium animate-fade-in">
              Saved
            </span>
          )}
          <button className="btn-primary" onClick={save} disabled={!canEdit || busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="text-base font-semibold">Business</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          The name shown to clients in their SMS and on the registration form.
        </p>
        <div className="card p-5 mt-3 space-y-4">
          <div>
            <label className="label">Business name</label>
            <input
              className="input"
              value={name ?? ''}
              disabled={!canEdit}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
