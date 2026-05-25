import Link from 'next/link';
import { ArrowRight, MessageSquareText, UserCircle } from 'lucide-react';
import { requireMember } from '@/lib/auth-guards';
import { BRAND } from '@/lib/brand';
import { SetupChecklist } from './components/setup-checklist';

export default async function DashboardHome() {
  const { supabase, profile } = await requireMember();
  const isAdmin = profile.role === 'admin';

  if (!isAdmin) {
    return <MemberHome name={profile.full_name ?? ''} />;
  }

  const { count } = await supabase
    .from('submissions')
    .select('id', { count: 'planned', head: true })
    .eq('workspace_id', profile.workspace_id);
  const submissionCount = count ?? 0;

  return (
    <div className="px-6 md:px-8 py-8 md:py-10 max-w-4xl">
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

function MemberHome({ name }: { name: string }) {
  return (
    <div className="px-6 md:px-8 py-8 md:py-10 max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">
        {name ? `Hi ${name.split(' ')[0]}` : 'Welcome'}
      </h1>
      <p className="text-slate-600 mt-1">
        You&apos;re signed in as a team member. Use the {BRAND.name} Chrome extension
        to send registration forms to clients.
      </p>

      <div className="grid gap-4 mt-8">
        <div className="card p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-brand-primary flex items-center justify-center shrink-0">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">Send forms from Chrome</h3>
              <p className="text-sm text-slate-600 mt-1">
                Open the {BRAND.name} extension in Chrome, type the client&apos;s
                phone number, and click Send. The dashboard is for admins to
                customise the form and review history.
              </p>
              {BRAND.chromeStoreUrl && (
                <a
                  href={BRAND.chromeStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary mt-4 inline-flex"
                >
                  Get the extension
                </a>
              )}
            </div>
          </div>
        </div>

        <Link href="/dashboard/account" className="card p-5 hover:border-rose-200 hover:shadow-md transition group">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <UserCircle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Account</h3>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-primary transition" />
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Update your name, email, password, or leave the workspace.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
