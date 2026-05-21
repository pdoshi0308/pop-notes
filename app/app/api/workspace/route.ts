import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/**
 * GET  /api/workspace  — read settings for the caller's workspace
 * PATCH /api/workspace — update settings (admins only)
 *
 * Both require a Bearer access_token. Used by the Chrome extension's
 * built-in Settings panel so admins can configure Twilio + Pusher in one
 * place without opening the web dashboard.
 */
export async function GET(req: NextRequest) {
  return handle(req, 'get');
}
export async function PATCH(req: NextRequest) {
  return handle(req, 'patch');
}

async function handle(req: NextRequest, mode: 'get' | 'patch') {
  try {
    const token = (req.headers.get('authorization') ?? '')
      .replace(/^Bearer\s+/i, '')
      .trim();
    if (!token) return jsonError('Missing access token', 401);

    const admin = createSupabaseAdminClient();
    const { data: userResult, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userResult?.user) return jsonError('Invalid session', 401);

    const { data: profile } = await admin
      .from('users')
      .select('workspace_id, role')
      .eq('id', userResult.user.id)
      .maybeSingle();
    if (!profile?.workspace_id) return jsonError('No workspace', 403);

    if (mode === 'get') {
      const { data: ws, error } = await admin
        .from('workspaces')
        .select(
          'id, name, twilio_account_sid, twilio_auth_token, twilio_from_number, pusher_app_id, pusher_key, pusher_secret, pusher_cluster, sms_template'
        )
        .eq('id', profile.workspace_id)
        .maybeSingle();
      if (error || !ws) return jsonError('Workspace not found', 404);
      return NextResponse.json({ ok: true, role: profile.role, workspace: ws });
    }

    // PATCH
    if (profile.role !== 'admin') return jsonError('Admins only', 403);

    const body = (await req.json()) as Record<string, unknown>;
    const allowed = [
      'name',
      'twilio_account_sid',
      'twilio_auth_token',
      'twilio_from_number',
      'pusher_app_id',
      'pusher_key',
      'pusher_secret',
      'pusher_cluster',
      'sms_template',
    ];
    const patch: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in body) patch[k] = body[k] === '' ? null : body[k];
    }

    const { error } = await admin
      .from('workspaces')
      .update(patch)
      .eq('id', profile.workspace_id);
    if (error) return jsonError(error.message, 400);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/workspace]', err);
    return jsonError('Workspace request failed', 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
