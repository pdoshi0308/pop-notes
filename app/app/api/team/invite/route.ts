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
    const role = body.role === 'admin' ? 'admin' : 'receptionist';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError('Enter a valid email', 400);
    }

    const admin = createSupabaseAdminClient();

    // Already in this workspace?
    const { data: existing } = await admin
      .from('users')
      .select('id')
      .eq('workspace_id', profile.workspace_id)
      .limit(50); // small workspace; client-side filter on auth user join not needed
    // (existence by email is checked below via auth lookup)

    // Don't allow inviting yourself.
    if (email === caller.email?.toLowerCase()) {
      return jsonError('You are already in this workspace', 400);
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

    // Existing auth user? If yes, we can't re-invite via inviteUserByEmail
    // (Supabase rejects it). For v1 we surface a clear error so the admin
    // knows the person already has a Pingform account; future work can
    // support cross-workspace membership.
    const { data: lookup } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    void lookup; // listUsers doesn't filter — we rely on inviteUserByEmail's own duplicate check

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? brandUrl();
    const { error: emailErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        invitation_id: invitation.id,
        invited_to_workspace: profile.workspace_id,
        invited_role: role,
      },
      redirectTo: `${appUrl}/dashboard/accept-invite`,
    });

    if (emailErr) {
      // Roll back the invitation if the email failed so the dashboard
      // doesn't show a "pending" row that never received an email.
      await admin.from('invitations').delete().eq('id', invitation.id);
      const msg = /already.*registered/i.test(emailErr.message)
        ? 'That email already has a Pingform account. Ask them to sign in instead.'
        : emailErr.message;
      return jsonError(msg, 400);
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
      .select('id, email, accepted_at')
      .eq('id', id)
      .eq('workspace_id', profile.workspace_id)
      .maybeSingle();
    if (!row) return jsonError('Invitation not found', 404);

    await admin.from('invitations').delete().eq('id', id);

    // If the invitee never accepted, we also delete the half-created
    // auth user that inviteUserByEmail produced — otherwise the email
    // address is stuck and can't be re-invited.
    if (!row.accepted_at) {
      const { data: list } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      const stub = list?.users?.find(
        (u) => u.email?.toLowerCase() === row.email.toLowerCase() && !u.last_sign_in_at
      );
      if (stub) {
        await admin.auth.admin.deleteUser(stub.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/team/invite DELETE]', err);
    return jsonError('Could not revoke invite', 500);
  }
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
