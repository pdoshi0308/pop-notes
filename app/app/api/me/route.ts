import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { PLAN_BY_ID, type PlanId } from '@/lib/plans';
import { resolvePusherClient } from '@/lib/pusher';

export const runtime = 'nodejs';

/**
 * GET /api/me
 * Returns the data the Chrome extension needs after sign-in.
 */
export async function GET(req: NextRequest) {
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
      .select('workspace_id, role, full_name')
      .eq('id', userResult.user.id)
      .maybeSingle();
    if (!profile?.workspace_id) {
      return jsonError('User is not assigned to a workspace', 403);
    }

    const { data: ws } = await admin
      .from('workspaces')
      .select(
        'id, name, pusher_app_id, pusher_key, pusher_secret, pusher_cluster, plan, sms_used_this_period, period_start'
      )
      .eq('id', profile.workspace_id)
      .maybeSingle();
    if (!ws) return jsonError('Workspace not found', 404);

    const plan: PlanId = ((ws.plan as PlanId) || 'free') as PlanId;
    const pusherClient = resolvePusherClient(ws);
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
        pusher_key: pusherClient.key,
        pusher_cluster: pusherClient.cluster,
      },
      billing: {
        plan,
        plan_name: PLAN_BY_ID[plan].name,
        sms_used: ws.sms_used_this_period ?? 0,
        sms_limit: PLAN_BY_ID[plan].sms_limit,
        period_start: ws.period_start,
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
