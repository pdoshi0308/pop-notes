import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Lock } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { FIELD_BY_ID } from '@/lib/fields';

interface Submission {
  id: string;
  phone: string | null;
  fields: Record<string, unknown>;
  created_at: string;
}

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.workspace_id) redirect('/dashboard/login?error=no_workspace');

  const { data: ws } = await supabase
    .from('workspaces')
    .select('plan')
    .eq('id', profile.workspace_id)
    .maybeSingle();

  const isPaid = (ws?.plan ?? 'free') !== 'free';

  return (
    <div className="px-8 py-10 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Submission history</h1>
      <p className="text-slate-600 mt-1">
        Every completed registration form, saved and searchable.
      </p>

      {isPaid ? <HistoryList /> : <UpsellCard />}
    </div>
  );
}

async function HistoryList() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('submissions')
    .select('id, phone, fields, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  const submissions = (data ?? []) as Submission[];

  if (submissions.length === 0) {
    return (
      <div className="card p-8 text-center mt-8">
        <p className="text-slate-600">
          No submissions yet. When a client completes a form, it&apos;ll appear
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-3">
      {submissions.map((s) => (
        <div key={s.id} className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">
              {String(s.fields?.full_name ?? s.phone ?? 'Submission')}
            </p>
            <time className="text-xs text-slate-400">
              {new Date(s.created_at).toLocaleString('en-GB')}
            </time>
          </div>
          <dl className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {Object.entries(s.fields ?? {}).map(([k, v]) => {
              if (v === '' || v == null) return null;
              const label = FIELD_BY_ID[k]?.label ?? k.replace(/_/g, ' ');
              return (
                <div key={k} className="flex gap-2">
                  <dt className="text-slate-400 shrink-0">{label}:</dt>
                  <dd className="text-slate-700 break-words">{String(v)}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </div>
  );
}

function UpsellCard() {
  return (
    <div className="card p-8 mt-8 text-center max-w-md mx-auto">
      <div className="w-12 h-12 rounded-xl bg-rose-50 text-brand-primary flex items-center justify-center mx-auto">
        <Lock className="w-5 h-5" />
      </div>
      <h2 className="mt-4 text-lg font-bold">Saved history is a paid feature</h2>
      <p className="mt-2 text-sm text-slate-600">
        On the Free plan, submissions arrive in real time but aren&apos;t stored.
        Upgrade to keep a permanent, searchable record of every completed form.
      </p>
      <Link href="/dashboard/billing" className="btn-primary mt-6 inline-flex">
        See plans
      </Link>
    </div>
  );
}
