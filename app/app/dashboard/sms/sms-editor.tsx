'use client';

import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { BRAND } from '@/lib/brand';

const VARIABLES = [
  { token: '{practice_name}', label: 'Business name' },
  { token: '{link}', label: 'Form link' },
];

export default function SmsEditor({
  workspaceId,
  practiceName,
  initial,
  canEdit,
}: {
  workspaceId: string;
  practiceName: string;
  initial: string;
  canEdit: boolean;
}) {
  const [body, setBody] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function insertVariable(token: string) {
    const el = ref.current;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from('workspaces')
      .update({ sms_template: body })
      .eq('id', workspaceId);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } else {
      alert(error.message);
    }
  }

  const preview = body
    .replaceAll('{practice_name}', practiceName)
    .replaceAll('{link}', `${BRAND.domain}/register?…`);

  return (
    <div className="px-8 py-10 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SMS Editor</h1>
          <p className="text-slate-600 mt-1">
            {canEdit
              ? 'Customise what the client sees when your team sends the form.'
              : 'Read-only — only admins can change the SMS template.'}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-sm text-brand-success font-medium animate-fade-in">
                Saved
              </span>
            )}
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        <div>
          <label className="label">Message</label>
          <textarea
            ref={ref}
            className="input min-h-[160px] font-mono text-sm disabled:cursor-not-allowed"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={!canEdit}
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-2 flex-wrap">
              {canEdit &&
                VARIABLES.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => insertVariable(v.token)}
                    className="text-xs px-2 py-1 rounded-full bg-rose-50 text-brand-primary font-medium hover:bg-rose-100"
                    title={`Insert ${v.token}`}
                  >
                    {v.label}
                  </button>
                ))}
            </div>
            <p className="text-xs text-slate-500">
              {body.length} chars · {Math.ceil(body.length / 160) || 1} SMS
            </p>
          </div>
        </div>

        <aside>
          <label className="label">Preview</label>
          <div className="mx-auto w-[300px] rounded-[36px] border border-slate-200 bg-white p-3 shadow-card">
            <div className="rounded-[28px] bg-gradient-to-b from-slate-100 to-slate-50 p-4 h-[400px]">
              <p className="text-xs text-center text-slate-400">iMessage</p>
              <div className="mt-4 max-w-[80%] rounded-2xl rounded-bl-md bg-white border border-slate-100 px-3 py-2 text-sm shadow-sm">
                {preview}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
