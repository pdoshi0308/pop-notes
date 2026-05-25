import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth-guards';
import SettingsForm from './settings-form';

export default async function SettingsPage() {
  const { supabase, profile } = await requireAdmin();

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', profile.workspace_id)
    .maybeSingle();

  if (!ws) redirect('/dashboard/login?error=no_workspace');

  return <SettingsForm workspace={ws} canEdit={true} />;
}
