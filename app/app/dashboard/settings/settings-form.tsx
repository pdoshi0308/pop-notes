'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useUnsavedChanges } from '@/lib/use-unsaved-changes';
import { Notice, type NoticeState } from '../components/notice';

interface Workspace {
  id: string;
  name: string;
}

const NAME_MAX = 80;

export default function SettingsForm({
  workspace,
  canEdit,
}: {
  workspace: Workspace;
  canEdit: boolean;
}) {
  const [name, setName] = useState(workspace.name);
  const [savedSnapshot, setSavedSnapshot] = useState(workspace.name);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState<NoticeState>(null);

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && trimmed.length <= NAME_MAX;
  const dirty = useMemo(() => trimmed !== savedSnapshot.trim(), [trimmed, savedSnapshot]);
  useUnsavedChanges(dirty);

  async function save() {
    if (!canEdit) return;
    if (!valid) {
      setNote({ kind: 'err', text: `Name must be 1–${NAME_MAX} characters.` });
      return;
    }
    setBusy(true);
    setSaved(false);
    setNote(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('workspaces')
      .update({ name: trimmed })
      .eq('id', workspace.id);
    setBusy(false);
    if (!error) {
      setSavedSnapshot(trimmed);
      setName(trimmed);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } else {
      setNote({ kind: 'err', text: error.message });
    }
  }

  return (
    <div className="px-6 md:px-8 py-8 md:py-10 max-w-3xl">
      <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
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
          <button
            className="btn-primary"
            onClick={save}
            disabled={!canEdit || busy || !dirty || !valid}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>

      {note && <div className="mb-4"><Notice note={note} /></div>}

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
              maxLength={NAME_MAX}
            />
            <p className="text-xs text-slate-400 mt-1">
              {trimmed.length}/{NAME_MAX}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
