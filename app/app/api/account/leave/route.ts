import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/**
 * POST /api/account/leave
 * Removes the caller from their workspace by clearing workspace_id. They
 * keep their auth account and can be re-invited later. Admins can't
 * leave — they must promote another admin or delete the workspace instead
 * (otherwise the workspace could be left without an admin).
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

    const { data: profile } = await admin
      .from('users')
      .select('workspace_id, role')
      .eq('id', caller.id)
      .maybeSingle();
    if (!profile?.workspace_id) return jsonError('You are not in a workspace', 400);

    if (profile.role === 'admin') {
      return jsonError(
        'Admins cannot leave. Promote another admin first, or delete the workspace.',
        400
      );
    }

    const { error } = await admin
      .from('users')
      .update({ workspace_id: null })
      .eq('id', caller.id);
    if (error) return jsonError(error.message, 400);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/account/leave]', err);
    return jsonError('Could not leave workspace', 500);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
