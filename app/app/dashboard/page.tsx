import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { SetupChecklist } from './components/setup-checklist';

export default async function DashboardHome() {
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
  // Scope to this user's workspace explicitly. RLS already filters server-side,
  // but a missing filter would force Postgres to count every row the policy
  // allows — expensive at scale. `planned` is a quick estimator that's
  // accurate enough for the "you've received N forms" badge.
  const { count } = profile?.workspace_id
    ? await supabase
        .from('submissions')
        .select('id', { count: 'planned', head: true })
        .eq('workspace_id', profile.workspace_id)
    : { count: 0 };
  const submissionCount = count ?? 0;

  return (
    <div className="px-8 py-10 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
      <p className="text-slate-600 mt-1">Quick links to get your business set up.</p>

      {BRAND.chromeStoreUrl && (
        <div className="mt-8">
          <SetupChecklist
            chromeStoreUrl={BRAND.chromeStoreUrl}
            submissionCount={submissionCount}
          />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <Card
          href="/dashboard/form"
          title="Customise your form"
          body="Pick which fields the client sees, in what order, and which are required."
        />
        <Card
          href="/dashboard/sms"
          title="Write your SMS"
          body="Edit the message that gets sent to the client when your team clicks Send Form."
        />
        <Card
          href="/dashboard/history"
          title="View submission history"
          body="Browse every completed registration form, with full details and timestamps."
        />
        <Card
          href="/dashboard/team"
          title="Invite your team"
          body="Add team members so they can sign into the Chrome extension."
        />
      </div>
    </div>
  );
}

function Card({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="card p-5 group hover:border-rose-200 hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-primary transition" />
      </div>
      <p className="text-sm text-slate-600 mt-1.5">{body}</p>
    </Link>
  );
}
