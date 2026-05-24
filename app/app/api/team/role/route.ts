import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/**
 * PATCH /api/team/role { user_id, role }
 * Admin-only. Updates a member's role within the caller's workspace.
 * Blocks demoting the workspace's last remaining admin to avoid lock-out.
 */
export async function PATCH(req: NextRequest) {
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

    const { user_id, role } = (await req.json()) as { user_id?: string; role?: string };
    if (!user_id) return jsonError('Missing user_id', 400);
    if (role !== 'admin' && role !== 'receptionist') {
      return jsonError('Role must be admin or receptionist', 400);
    }

    const { data: target } = await admin
      .from('users')
      .select('id, role, workspace_id')
      .eq('id', user_id)
      .maybeSingle();
    if (!target || target.workspace_id !== callerProfile.workspace_id) {
      return jsonError('User not in your workspace', 404);
    }

    // Sole-admin guard: don't let the last admin demote themselves.
    if (target.role === 'admin' && role !== 'admin') {
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

    const { error } = await admin
      .from('users')
      .update({ role })
      .eq('id', user_id);
    if (error) return jsonError(error.message, 400);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/team/role]', err);
    return jsonError('Could not update role', 500);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
