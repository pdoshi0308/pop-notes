import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import TeamPanel from './team-panel';

export default async function TeamPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.workspace_id) redirect('/dashboard/login?error=no_workspace');

  const { data: members } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('workspace_id', profile.workspace_id);

  return (
    <TeamPanel
      workspaceId={profile.workspace_id}
      currentUserId={user.id}
      isAdmin={profile.role === 'admin'}
      members={(members ?? []).map((m) => ({
        id: m.id,
        full_name: m.full_name ?? '—',
        role: m.role,
      }))}
    />
  );
}
