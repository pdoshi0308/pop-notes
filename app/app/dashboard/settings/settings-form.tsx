'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface Workspace {
  id: string;
  name: string;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_from_number: string | null;
  pusher_app_id: string | null;
  pusher_key: string | null;
  pusher_secret: string | null;
  pusher_cluster: string | null;
}

export default function SettingsForm({
  workspace,
  canEdit,
}: {
  workspace: Workspace;
  canEdit: boolean;
}) {
  const [form, setForm] = useState<Workspace>(workspace);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof Workspace>(key: K, value: Workspace[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!canEdit) return;
    setBusy(true);
    setSaved(false);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('workspaces')
      .update({
        name: form.name,
        twilio_account_sid: form.twilio_account_sid,
        twilio_auth_token: form.twilio_auth_token,
        twilio_from_number: form.twilio_from_number,
        pusher_app_id: form.pusher_app_id,
        pusher_key: form.pusher_key,
        pusher_secret: form.pusher_secret,
        pusher_cluster: form.pusher_cluster,
      })
      .eq('id', form.id);
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
          <p className="text-slate-600 mt-1">Bring your own SMS and realtime credentials.</p>
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

      <Section title="Practice">
        <Field label="Practice name">
          <input
            className="input"
            value={form.name ?? ''}
            disabled={!canEdit}
            onChange={(e) => update('name', e.target.value)}
          />
        </Field>
      </Section>

      <Section
        title="Twilio"
        subtitle="Where your patient SMS messages will be sent from."
      >
        <Field label="Account SID">
          <input
            className="input"
            value={form.twilio_account_sid ?? ''}
            disabled={!canEdit}
            onChange={(e) => update('twilio_account_sid', e.target.value)}
          />
        </Field>
        <Field label="Auth Token">
          <input
            type="password"
            className="input"
            value={form.twilio_auth_token ?? ''}
            disabled={!canEdit}
            onChange={(e) => update('twilio_auth_token', e.target.value)}
          />
        </Field>
        <Field label="From Number (E.164, e.g. +44...)">
          <input
            className="input"
            placeholder="+447700900000"
            value={form.twilio_from_number ?? ''}
            disabled={!canEdit}
            onChange={(e) => update('twilio_from_number', e.target.value)}
          />
        </Field>
      </Section>

      <Section
        title="Pusher"
        subtitle="Used to push completed form data back to the extension in real time."
      >
        <Field label="App ID">
          <input
            className="input"
            value={form.pusher_app_id ?? ''}
            disabled={!canEdit}
            onChange={(e) => update('pusher_app_id', e.target.value)}
          />
        </Field>
        <Field label="Key">
          <input
            className="input"
            value={form.pusher_key ?? ''}
            disabled={!canEdit}
            onChange={(e) => update('pusher_key', e.target.value)}
          />
        </Field>
        <Field label="Secret">
          <input
            type="password"
            className="input"
            value={form.pusher_secret ?? ''}
            disabled={!canEdit}
            onChange={(e) => update('pusher_secret', e.target.value)}
          />
        </Field>
        <Field label="Cluster (e.g. eu)">
          <input
            className="input"
            value={form.pusher_cluster ?? ''}
            disabled={!canEdit}
            onChange={(e) => update('pusher_cluster', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Billing">
        <div className="card p-5 text-sm">
          <p className="font-semibold">Free trial</p>
          <p className="text-slate-600 mt-1">
            Stripe billing isn&apos;t wired up yet. This space will show plan + usage
            once subscriptions are connected.
          </p>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      <div className="card p-5 mt-3 space-y-4">{children}</div>
    </section>
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
