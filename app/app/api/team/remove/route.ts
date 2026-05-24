import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/**
 * POST /api/team/remove { user_id }
 *
 * Admin-only. Removes a teammate from the caller's workspace by clearing
 * their workspace_id and signing them out so their dashboard tab can't
 * keep operating. Enforces:
 *   - target must belong to caller's workspace
 *   - admin cannot remove themselves (they should leave or delete instead)
 *   - cannot remove the last remaining admin
 */
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') ?? '')
      .replace(/^Bearer\s+/i, '')
      .trim();
    if (!token) return jsonError('Missing access token', 401);

    const admin = createSupabaseAdminClient();
    const { data: userResult } = await admin.auth.getUser(token);
    const caller = userResult?.user;
    if (!caller) return jsonError('Invalid session', 401);

    const { data: callerProfile } = await admin
      .from('users')
      .select('workspace_id, role')
      .eq('id', caller.id)
      .maybeSingle();
    if (!callerProfile?.workspace_id) return jsonError('No workspace', 403);
    if (callerProfile.role !== 'admin') return jsonError('Admins only', 403);

    const { user_id } = (await req.json()) as { user_id?: string };
    if (!user_id) return jsonError('Missing user_id', 400);
    if (user_id === caller.id) {
      return jsonError(
        'You can\'t remove yourself. Use Account → Leave or Delete instead.',
        400
      );
    }

    const { data: target } = await admin
      .from('users')
      .select('id, role, workspace_id')
      .eq('id', user_id)
      .maybeSingle();
    if (!target || target.workspace_id !== callerProfile.workspace_id) {
      return jsonError('User is not in your workspace', 404);
    }

    if (target.role === 'admin') {
      const { count } = await admin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', callerProfile.workspace_id)
        .eq('role', 'admin');
      if ((count ?? 0) <= 1) {
        return jsonError(
          'You are the only admin. Promote another member to admin first.',
          400
        );
      }
    }

    const { error: updErr } = await admin
      .from('users')
      .update({ workspace_id: null })
      .eq('id', user_id);
    if (updErr) return jsonError(updErr.message, 400);

    // Best-effort: kill the removed user's active session so their open
    // dashboard tab stops working immediately. Ignore failures — the worst
    // case is they get redirected to /login on their next request anyway
    // (the layout guards on workspace_id).
    try {
      await admin.auth.admin.signOut(user_id);
    } catch (err) {
      console.error('[/api/team/remove signOut]', err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/team/remove]', err);
    return jsonError('Could not remove member', 500);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
