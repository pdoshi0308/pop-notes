import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { getStripe, stripeConfigured } from '@/lib/stripe';

export const runtime = 'nodejs';

/**
 * DELETE /api/workspace/delete { confirm_name }
 *
 * Admin-only nuclear option. Cancels any active Stripe subscription,
 * deletes the workspace row (cascades into users, form_configs,
 * submissions, invitations), and deletes the admin's own auth user so
 * they can sign up fresh if they ever want to. `confirm_name` must match
 * the workspace name as a typed confirmation.
 */
export async function DELETE(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') ?? '')
      .replace(/^Bearer\s+/i, '')
      .trim();
    if (!token) return jsonError('Missing access token', 401);

    const admin = createSupabaseAdminClient();
    const { data: userResult } = await admin.auth.getUser(token);
    const caller = userResult?.user;
    if (!caller) return jsonError('Invalid session', 401);

    const { data: profile } = await admin
      .from('users')
      .select('workspace_id, role')
      .eq('id', caller.id)
      .maybeSingle();
    if (!profile?.workspace_id) return jsonError('No workspace', 403);
    if (profile.role !== 'admin') return jsonError('Admins only', 403);

    const { confirm_name } = (await req.json()) as { confirm_name?: string };

    const { data: ws } = await admin
      .from('workspaces')
      .select('id, name, stripe_subscription_id')
      .eq('id', profile.workspace_id)
      .maybeSingle();
    if (!ws) return jsonError('Workspace not found', 404);

    if ((confirm_name ?? '').trim().toLowerCase() !== ws.name.toLowerCase()) {
      return jsonError(
        `To confirm, type the workspace name exactly: "${ws.name}"`,
        400
      );
    }

    // Cancel Stripe subscription first so we don't keep billing after the
    // workspace is gone.
    if (stripeConfigured() && ws.stripe_subscription_id) {
      try {
        await getStripe()!.subscriptions.cancel(ws.stripe_subscription_id);
      } catch (err) {
        console.error('[workspace/delete stripe]', err);
      }
    }

    // Collect every auth user attached to this workspace before we delete
    // the workspace row — once the row is gone we lose the join.
    const { data: members } = await admin
      .from('users')
      .select('id')
      .eq('workspace_id', ws.id);

    // ON DELETE CASCADE on the workspace removes public.users rows,
    // form_configs, submissions, and invitations.
    const { error: wsErr } = await admin
      .from('workspaces')
      .delete()
      .eq('id', ws.id);
    if (wsErr) return jsonError(wsErr.message, 400);

    // Now delete each auth user too — the cascade only handled the
    // application-side rows.
    for (const m of members ?? []) {
      try {
        await admin.auth.admin.deleteUser(m.id);
      } catch (err) {
        console.error('[workspace/delete user]', m.id, err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/workspace/delete]', err);
    return jsonError('Could not delete workspace', 500);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
