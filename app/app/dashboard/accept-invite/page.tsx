import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import AcceptInviteForm from './accept-invite-form';

export default async function AcceptInvitePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // The Supabase invite email links should sign the user in automatically.
    // If we landed here without a session, send them to login so they can
    // request a magic link or re-open the original email link.
    redirect('/dashboard/login?error=accept_invite_needs_session');
  }

  // Find which workspace the invite attached us to (the auth trigger has
  // already run by the time we're here, so the row is in place).
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, workspace_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.workspace_id) {
    redirect('/dashboard/login?error=invite_expired');
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', profile.workspace_id)
    .maybeSingle();

  return (
    <AcceptInviteForm
      email={user.email ?? ''}
      workspaceName={workspace?.name ?? 'your team'}
      role={profile.role}
      existingName={profile.full_name ?? ''}
    />
  );
}
