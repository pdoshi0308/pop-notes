import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import SmsEditor from './sms-editor';

export default async function SmsPage() {
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
  if (!profile?.workspace_id) redirect('/dashboard/login?error=no_workspace');

  const { data: ws } = await supabase
    .from('workspaces')
    .select('name, sms_template')
    .eq('id', profile.workspace_id)
    .maybeSingle();

  return (
    <SmsEditor
      workspaceId={profile.workspace_id}
      practiceName={ws?.name ?? 'Your Business'}
      initial={
        ws?.sms_template ||
        'Hi! {practice_name} has asked you to complete a quick registration form. It only takes 1 minute 👉 {link}'
      }
    />
  );
}
