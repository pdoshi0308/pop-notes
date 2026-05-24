import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import AccountForm from './account-form';

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, workspace_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.workspace_id) redirect('/dashboard/login?error=no_workspace');

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', profile.workspace_id)
    .maybeSingle();

  return (
    <AccountForm
      email={user.email ?? ''}
      fullName={profile.full_name ?? ''}
      role={profile.role}
      workspaceName={ws?.name ?? ''}
    />
  );
}
