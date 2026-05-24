import { redirect } from 'next/navigation';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import AcceptInviteForm from './accept-invite-form';

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ inv?: string }>;
}) {
  const { inv } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // The Supabase invite/magic-link email signs the user in automatically.
    // If we landed here without a session, ask them to open the link again.
    redirect('/dashboard/login?error=accept_invite_needs_session');
  }

  const admin = createSupabaseAdminClient();

  // Find a pending invitation for this user. Prefer the explicit `inv`
  // query param we set on the redirectTo, fall back to the most recent
  // pending row matching their email (handles re-opened links and
  // OAuth-after-invite races).
  let pendingInvite: {
    id: string;
    workspace_id: string;
    role: string;
    workspace_name: string | null;
  } | null = null;

  if (inv) {
    const { data } = await admin
      .from('invitations')
      .select('id, workspace_id, role, email, accepted_at, expires_at')
      .eq('id', inv)
      .maybeSingle();
    if (
      data &&
      !data.accepted_at &&
      new Date(data.expires_at) > new Date() &&
      data.email.toLowerCase() === (user.email ?? '').toLowerCase()
    ) {
      const { data: ws } = await admin
        .from('workspaces')
        .select('name')
        .eq('id', data.workspace_id)
        .maybeSingle();
      pendingInvite = {
        id: data.id,
        workspace_id: data.workspace_id,
        role: data.role,
        workspace_name: ws?.name ?? null,
      };
    }
  }

  if (!pendingInvite && user.email) {
    const { data } = await admin
      .from('invitations')
      .select('id, workspace_id, role, email, accepted_at, expires_at')
      .ilike('email', user.email)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const { data: ws } = await admin
        .from('workspaces')
        .select('name')
        .eq('id', data.workspace_id)
        .maybeSingle();
      pendingInvite = {
        id: data.id,
        workspace_id: data.workspace_id,
        role: data.role,
        workspace_name: ws?.name ?? null,
      };
    }
  }

  // Existing application profile (might already be in another workspace).
  const { data: profile } = await admin
    .from('users')
    .select('full_name, workspace_id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!pendingInvite) {
    // No pending invite. If they already have a workspace, drop them on
    // the dashboard; otherwise the invite has expired/been revoked.
    if (profile?.workspace_id) redirect('/dashboard');
    redirect('/dashboard/login?error=invite_expired');
  }

  const alreadyInTargetWorkspace =
    profile?.workspace_id === pendingInvite.workspace_id;

  // OAuth-only users have no email identity yet, so we offer to set a
  // password. Users with an existing password keep it untouched.
  const hasPassword = (user.identities ?? []).some(
    (i) => i.provider === 'email'
  );

  return (
    <AcceptInviteForm
      email={user.email ?? ''}
      workspaceName={pendingInvite.workspace_name ?? 'your team'}
      role={pendingInvite.role}
      existingName={profile?.full_name ?? ''}
      invitationId={pendingInvite.id}
      alreadyInTargetWorkspace={alreadyInTargetWorkspace}
      currentWorkspaceId={profile?.workspace_id ?? null}
      needsPassword={!hasPassword}
    />
  );
}
