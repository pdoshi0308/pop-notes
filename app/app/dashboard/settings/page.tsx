import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import SettingsForm from './settings-form';

export default async function SettingsPage() {
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

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', profile.workspace_id)
    .maybeSingle();

  if (!ws) redirect('/dashboard/login?error=no_workspace');

  return <SettingsForm workspace={ws} canEdit={profile.role === 'admin'} />;
}
