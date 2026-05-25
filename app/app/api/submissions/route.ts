import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/**
 * DELETE /api/submissions { id }
 * Admin-only. Permanently removes a submission from the caller's workspace.
 * Used for GDPR right-to-erasure requests.
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

    const { id } = (await req.json()) as { id?: string };
    if (!id) return jsonError('Missing id', 400);

    const { data: row } = await admin
      .from('submissions')
      .select('id, workspace_id')
      .eq('id', id)
      .maybeSingle();
    if (!row || row.workspace_id !== profile.workspace_id) {
      return jsonError('Submission not found', 404);
    }

    const { error } = await admin.from('submissions').delete().eq('id', id);
    if (error) return jsonError(error.message, 400);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/submissions DELETE]', err);
    return jsonError('Could not delete submission', 500);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
