import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import SignOutButton from './components/sign-out-button';
import NavLinks from './components/nav-links';
import MobileHeader from './components/mobile-header';
import IdleSignOutWatcher from './components/idle-sign-out-watcher';
import { BRAND } from '@/lib/brand';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div className="min-h-screen bg-brand-bg">{children}</div>;
  }

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, workspace_id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.workspace_id) {
    return <div className="min-h-screen bg-brand-bg">{children}</div>;
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', profile.workspace_id)
    .maybeSingle();

  const fullName = profile?.full_name ?? '';
  const email = user.email ?? '';
  const workspaceName = workspace?.name ?? 'Business';
  const role = profile?.role ?? 'member';

  return (
    <div className="min-h-screen bg-brand-bg md:flex">
      <IdleSignOutWatcher />
      <MobileHeader
        role={role}
        fullName={fullName}
        email={email}
        workspaceName={workspaceName}
      />
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-5 border-b border-slate-100">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-extrabold text-lg tracking-tight"
          >
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent" />
            {BRAND.name}
          </Link>
          <p className="mt-3 text-xs text-slate-500 truncate">{workspaceName}</p>
        </div>
        <NavLinks role={role} />
        <div className="mt-auto p-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
              {(fullName || email || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="text-xs flex-1 min-w-0">
              <p className="font-medium truncate">{fullName || email}</p>
              <p className="text-slate-500 truncate">{email}</p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
