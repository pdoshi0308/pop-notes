import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { getStripe, stripeConfigured } from '@/lib/stripe';

export const runtime = 'nodejs';

/**
 * PATCH  /api/account { full_name }     — update the caller's profile name
 * DELETE /api/account                   — delete the caller's own auth user
 *
 * The PATCH path updates public.users.full_name (used everywhere the
 * dashboard prints the user's name). The DELETE path removes the auth user;
 * ON DELETE CASCADE on public.users.id wipes the application profile. We
 * block the call when the caller is the workspace's sole admin so they
 * can't lock the workspace.
 */
export async function PATCH(req: NextRequest) {
  try {
    const { caller, error } = await authed(req);
    if (error) return error;

    const { full_name } = (await req.json()) as { full_name?: string };
    if (typeof full_name !== 'string' || !full_name.trim()) {
      return jsonError('Name is required', 400);
    }

    const admin = createSupabaseAdminClient();
    const trimmed = full_name.trim();

    const { error: pErr } = await admin
      .from('users')
      .update({ full_name: trimmed })
      .eq('id', caller.id);
    if (pErr) return jsonError(pErr.message, 400);

    // Keep auth metadata in sync so it also appears in JWTs / emails.
    await admin.auth.admin.updateUserById(caller.id, {
      user_metadata: { ...(caller.user_metadata ?? {}), full_name: trimmed },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/account PATCH]', err);
    return jsonError('Could not save', 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { caller, profile, error } = await authed(req);
    if (error) return error;

    const admin = createSupabaseAdminClient();

    // Sole-admin guard.
    if (profile.role === 'admin') {
      const { count } = await admin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', profile.workspace_id)
        .eq('role', 'admin');
      if ((count ?? 0) <= 1) {
        // If they're the only person at all in the workspace, let them
        // delete — the workspace is effectively theirs and abandoning it
        // is fine. If there are other members, block until they promote
        // someone or delete the workspace.
        const { count: total } = await admin
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', profile.workspace_id);
        if ((total ?? 0) > 1) {
          return jsonError(
            'You are the only admin. Promote another member to admin first, or delete the entire workspace.',
            400
          );
        }
        // Sole occupant — cancel any active Stripe subscription on the way out.
        await cancelWorkspaceSubscription(profile.workspace_id);
      }
    }

    const { error: dErr } = await admin.auth.admin.deleteUser(caller.id);
    if (dErr) return jsonError(dErr.message, 400);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/account DELETE]', err);
    return jsonError('Could not delete account', 500);
  }
}

async function authed(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (!token) return { error: jsonError('Missing access token', 401) } as const;
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
  return { caller, profile: { workspace_id: profile.workspace_id, role: profile.role } } as const;
}

async function cancelWorkspaceSubscription(workspaceId: string) {
  if (!stripeConfigured()) return;
  const admin = createSupabaseAdminClient();
  const { data: ws } = await admin
    .from('workspaces')
    .select('stripe_subscription_id')
    .eq('id', workspaceId)
    .maybeSingle();
  if (!ws?.stripe_subscription_id) return;
  const stripe = getStripe()!;
  try {
    await stripe.subscriptions.cancel(ws.stripe_subscription_id);
  } catch (err) {
    console.error('[cancelWorkspaceSubscription]', err);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
