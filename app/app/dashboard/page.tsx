import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

export default async function DashboardHome() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  return (
    <div className="px-8 py-10 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
      <p className="text-slate-600 mt-1">Quick links to get your business set up.</p>

      <div className="grid sm:grid-cols-2 gap-4 mt-8">
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
          href="/dashboard/settings"
          title="Connect Twilio + Pusher"
          body="Add your SMS provider credentials and realtime keys so the extension can send and receive."
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
