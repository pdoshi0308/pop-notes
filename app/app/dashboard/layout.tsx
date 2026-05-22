import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import SignOutButton from './components/sign-out-button';
import NavLinks from './components/nav-links';
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

  // Login page handles its own layout via the `(unauth)` route inside `/dashboard/login`.
  // For now, we treat the login route as exempt by skipping the redirect there.
  // Detection is done inside the page itself via the absence of a session.
  if (!user) {
    // No session — render only children (the login page will appear here).
    return <div className="min-h-screen bg-brand-bg">{children}</div>;
  }

  // Fetch the workspace name + user profile for the sidebar header.
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, workspace_id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.workspace_id) {
    redirect('/dashboard/login?error=no_workspace');
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', profile!.workspace_id!)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-brand-bg flex">
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-5 border-b border-slate-100">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-extrabold text-lg tracking-tight"
          >
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent" />
            {BRAND.name}
          </Link>
          <p className="mt-3 text-xs text-slate-500">{workspace?.name ?? 'Business'}</p>
        </div>
        <NavLinks role={profile?.role ?? 'admin'} />
        <div className="mt-auto p-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
              {(profile?.full_name ?? user.email ?? '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="text-xs flex-1 min-w-0">
              <p className="font-medium truncate">{profile?.full_name ?? user.email}</p>
              <p className="text-slate-500 truncate">{user.email}</p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
