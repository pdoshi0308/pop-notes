'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function DeleteSubmissionButton({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    if (
      !confirm(
        `Permanently delete the submission for ${label}? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    const res = await fetch('/api/submissions', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !body.ok) {
      setErr(body.error ?? 'Could not delete');
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-xs text-rose-700">{err}</span>}
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-brand-error transition disabled:opacity-50"
        title="Delete submission"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </button>
    </div>
  );
}
