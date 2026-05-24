import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { brandUrl } from '@/lib/brand';

export const runtime = 'nodejs';

/**
 * POST   /api/team/invite { email, role }      — admin invites a teammate
 * DELETE /api/team/invite { id }               — admin revokes a pending invite
 *
 * Source of truth is public.invitations. We also call Supabase's
 * inviteUserByEmail so the user gets a magic-link email; the metadata we
 * pass through is read by the handle_new_auth_user trigger so the invitee
 * joins THIS workspace (instead of getting their own brand-new one).
 */
export async function POST(req: NextRequest) {
  try {
    const { caller, profile, error } = await authedAdmin(req);
    if (error) return error;

    const body = (await req.json()) as { email?: string; role?: string };
    const email = (body.email ?? '').trim().toLowerCase();
    const role = body.role === 'admin' ? 'admin' : 'member';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError('Enter a valid email', 400);
    }

    const admin = createSupabaseAdminClient();

    // Don't allow inviting yourself.
    if (email === caller.email?.toLowerCase()) {
      return jsonError('You are already in this workspace', 400);
    }

    // Already a member of this workspace?
    const existingAuthUser = await findAuthUserByEmail(admin, email);
    if (existingAuthUser) {
      const { data: existingProfile } = await admin
        .from('users')
        .select('workspace_id')
        .eq('id', existingAuthUser.id)
        .maybeSingle();
      if (existingProfile?.workspace_id === profile.workspace_id) {
        return jsonError('They are already in this workspace', 400);
      }
    }

    // Upsert the invitation row.
    const { data: invitation, error: inviteErr } = await admin
      .from('invitations')
      .upsert(
        {
          workspace_id: profile.workspace_id,
          email,
          role,
          invited_by: caller.id,
          accepted_at: null,
          auth_user_id: existingAuthUser?.id ?? null,
          // refresh expiry on every resend
          expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        },
        { onConflict: 'workspace_id,email' }
      )
      .select('id')
      .single();
    if (inviteErr || !invitation) {
      return jsonError(inviteErr?.message ?? 'Could not create invitation', 400);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? brandUrl();
    const redirectTo = `${appUrl}/dashboard/accept-invite?inv=${invitation.id}`;

    if (existingAuthUser) {
      // The invitee already has an account. We can't use inviteUserByEmail
      // (Supabase rejects it), so send them a magic-link email that drops
      // them on /dashboard/accept-invite where they can confirm and join
      // this workspace. Their existing password is untouched.
      const { error: linkErr } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo },
      });
      if (linkErr) {
        await admin.from('invitations').delete().eq('id', invitation.id);
        return jsonError(linkErr.message, 400);
      }
      return NextResponse.json({ ok: true, existing_user: true });
    }

    // Brand-new email: send the Supabase invite email so they can set a
    // password. Metadata is read by handle_new_auth_user to attach them
    // straight to the inviting workspace.
    const { data: created, error: emailErr } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: {
          invitation_id: invitation.id,
          invited_to_workspace: profile.workspace_id,
          invited_role: role,
        },
        redirectTo,
      });

    if (emailErr) {
      await admin.from('invitations').delete().eq('id', invitation.id);
      return jsonError(emailErr.message, 400);
    }

    // Remember the stub auth user we just minted so revoke can clean it up
    // without scanning auth.users.
    if (created?.user?.id) {
      await admin
        .from('invitations')
        .update({ auth_user_id: created.user.id })
        .eq('id', invitation.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/team/invite POST]', err);
    return jsonError('Could not send invite', 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { profile, error } = await authedAdmin(req);
    if (error) return error;

    const { id } = (await req.json()) as { id?: string };
    if (!id) return jsonError('Missing id', 400);

    const admin = createSupabaseAdminClient();

    // Only delete invites that belong to the admin's workspace.
    const { data: row } = await admin
      .from('invitations')
      .select('id, email, accepted_at, auth_user_id')
      .eq('id', id)
      .eq('workspace_id', profile.workspace_id)
      .maybeSingle();
    if (!row) return jsonError('Invitation not found', 404);

    await admin.from('invitations').delete().eq('id', id);

    // If the invitee never accepted, also delete the stub auth user that
    // inviteUserByEmail produced — otherwise the address is stuck and can't
    // be re-invited. We only do this if that stub never confirmed/used the
    // account (no last_sign_in_at, no other workspace).
    if (!row.accepted_at && row.auth_user_id) {
      const { data: stubAuth } = await admin.auth.admin.getUserById(
        row.auth_user_id
      );
      const { data: stubProfile } = await admin
        .from('users')
        .select('workspace_id')
        .eq('id', row.auth_user_id)
        .maybeSingle();
      const hasOtherWorkspace =
        stubProfile?.workspace_id &&
        stubProfile.workspace_id !== profile.workspace_id;
      if (stubAuth?.user && !stubAuth.user.last_sign_in_at && !hasOtherWorkspace) {
        await admin.auth.admin.deleteUser(row.auth_user_id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/team/invite DELETE]', err);
    return jsonError('Could not revoke invite', 500);
  }
}

/**
 * Find an auth user by email by paginating listUsers (Supabase doesn't
 * expose a server-side filter). Returns null when not found.
 */
async function findAuthUserByEmail(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string
) {
  const target = email.toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < perPage) return null;
  }
  return null;
}

async function authedAdmin(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (!token) {
    return { error: jsonError('Missing access token', 401) } as const;
  }
  const admin = createSupabaseAdminClient();
  const { data: userResult } = await admin.auth.getUser(token);
  const caller = userResult?.user;
  if (!caller) return { error: jsonError('Invalid session', 401) } as const;

  const { data: profile } = await admin
    .from('users')
    .select('workspace_id, role')
    .eq('id', caller.id)
    .maybeSingle();
  if (!profile?.workspace_id) {
    return { error: jsonError('No workspace', 403) } as const;
  }
  if (profile.role !== 'admin') {
    return { error: jsonError('Admins only', 403) } as const;
  }
  return { caller, profile: { workspace_id: profile.workspace_id, role: profile.role } } as const;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
