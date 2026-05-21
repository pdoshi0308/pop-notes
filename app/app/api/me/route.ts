import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/**
 * GET /api/me
 * Headers: Authorization: Bearer <Supabase access_token>
 *
 * Returns the data the Chrome extension needs immediately after sign-in:
 * workspace id + name, role, Pusher key + cluster so the client can subscribe.
 * Pusher secret is intentionally NOT returned.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return jsonError('Missing access token', 401);

    const admin = createSupabaseAdminClient();
    const { data: userResult, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userResult?.user) return jsonError('Invalid session', 401);

    const { data: profile } = await admin
      .from('users')
      .select('workspace_id, role, full_name')
      .eq('id', userResult.user.id)
      .maybeSingle();

    if (!profile?.workspace_id) {
      return jsonError('User is not assigned to a workspace', 403);
    }

    const { data: ws } = await admin
      .from('workspaces')
      .select('id, name, pusher_key, pusher_cluster')
      .eq('id', profile.workspace_id)
      .maybeSingle();

    if (!ws) return jsonError('Workspace not found', 404);

    return NextResponse.json({
      ok: true,
      user: {
        email: userResult.user.email,
        full_name: profile.full_name,
        role: profile.role,
      },
      workspace: {
        id: ws.id,
        name: ws.name,
        pusher_key: ws.pusher_key,
        pusher_cluster: ws.pusher_cluster,
      },
    });
  } catch (err) {
    console.error('[/api/me]', err);
    return jsonError('Could not load profile', 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
