import Link from 'next/link';
import { Lock, Search } from 'lucide-react';
import { requireAdmin } from '@/lib/auth-guards';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { FIELD_BY_ID } from '@/lib/fields';
import DeleteSubmissionButton from './delete-button';

interface Submission {
  id: string;
  phone: string | null;
  fields: Record<string, unknown>;
  created_at: string;
}

const PAGE_SIZE = 50;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? '').trim();
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);

  const { supabase, profile } = await requireAdmin();

  const { data: ws } = await supabase
    .from('workspaces')
    .select('plan')
    .eq('id', profile.workspace_id)
    .maybeSingle();

  const isPaid = (ws?.plan ?? 'free') !== 'free';

  return (
    <div className="px-6 md:px-8 py-8 md:py-10 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Submission history</h1>
      <p className="text-slate-600 mt-1">
        Every completed registration form, saved and searchable.
      </p>

      {isPaid ? (
        <HistoryList workspaceId={profile.workspace_id} q={q} page={page} />
      ) : (
        <UpsellCard />
      )}
    </div>
  );
}

async function HistoryList({
  workspaceId,
  q,
  page,
}: {
  workspaceId: string;
  q: string;
  page: number;
}) {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from('submissions')
    .select('id, phone, fields, created_at', { count: 'estimated' })
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (q) {
    const escaped = q.replace(/[%_]/g, (c) => `\\${c}`);
    query = query.or(
      `phone.ilike.%${escaped}%,fields->>full_name.ilike.%${escaped}%`
    );
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count, error } = await query.range(from, to);

  if (error) {
    return (
      <div className="card p-6 mt-6 border-rose-100">
        <p className="text-sm text-rose-700 font-medium">
          Could not load submissions: {error.message}
        </p>
      </div>
    );
  }

  const submissions = (data ?? []) as Submission[];
  const total = count ?? submissions.length;
  const hasPrev = page > 1;
  const hasNext = submissions.length === PAGE_SIZE;

  return (
    <>
      <form className="mt-6 flex gap-2 items-center" action="">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name or phone"
            className="input pl-9"
          />
        </div>
        <button className="btn-secondary" type="submit">
          Search
        </button>
        {q && (
          <Link href="/dashboard/history" className="text-sm text-slate-500 hover:underline">
            Clear
          </Link>
        )}
      </form>

      {submissions.length === 0 ? (
        <div className="card p-8 text-center mt-6">
          <p className="text-slate-600">
            {q ? (
              <>No submissions match &ldquo;{q}&rdquo;.</>
            ) : (
              <>
                No submissions yet. When a client completes a form, it&apos;ll
                appear here.
              </>
            )}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400 mt-6">
            Showing {from + 1}–{from + submissions.length}
            {total > submissions.length ? ` of ~${total}` : ''}
            {q && ` for "${q}"`}
          </p>
          <div className="mt-3 space-y-3">
            {submissions.map((s) => {
              const label = String(s.fields?.full_name ?? s.phone ?? 'Submission');
              return (
                <div key={s.id} className="card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{label}</p>
                    <div className="flex items-center gap-3">
                      <time className="text-xs text-slate-400">
                        {new Date(s.created_at).toLocaleString('en-GB')}
                      </time>
                      <DeleteSubmissionButton id={s.id} label={label} />
                    </div>
                  </div>
                  <dl className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    {Object.entries(s.fields ?? {}).map(([k, v]) => {
                      if (v === '' || v == null) return null;
                      const fieldLabel = FIELD_BY_ID[k]?.label ?? k.replace(/_/g, ' ');
                      return (
                        <div key={k} className="flex gap-2">
                          <dt className="text-slate-400 shrink-0">{fieldLabel}:</dt>
                          <dd className="text-slate-700 break-words">{String(v)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              );
            })}
          </div>

          {(hasPrev || hasNext) && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <PagerLink page={page - 1} q={q} disabled={!hasPrev}>
                ← Previous
              </PagerLink>
              <span className="text-xs text-slate-400">Page {page}</span>
              <PagerLink page={page + 1} q={q} disabled={!hasNext}>
                Next →
              </PagerLink>
            </div>
          )}
        </>
      )}
    </>
  );
}

function PagerLink({
  page,
  q,
  disabled,
  children,
}: {
  page: number;
  q: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="btn-secondary opacity-40 pointer-events-none">{children}</span>
    );
  }
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return (
    <Link className="btn-secondary" href={`/dashboard/history${qs ? `?${qs}` : ''}`}>
      {children}
    </Link>
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
