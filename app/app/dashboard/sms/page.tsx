import { requireAdmin } from '@/lib/auth-guards';
import SmsEditor from './sms-editor';

export default async function SmsPage() {
  const { supabase, profile } = await requireAdmin();

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
      canEdit={true}
    />
  );
}
