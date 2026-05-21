import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { toE164 } from '@/lib/phone';
import { PLAN_BY_ID, type PlanId } from '@/lib/plans';
import { brandUrl } from '@/lib/brand';

export const runtime = 'nodejs';

/**
 * POST /api/send  { phone }
 * Headers: Authorization: Bearer <Supabase access_token>
 *
 * Flow:
 *   1. Validate JWT
 *   2. Look up workspace + plan
 *   3. Roll the usage counter if a new billing period has started
 *   4. Refuse if the workspace is over its SMS allowance
 *   5. Send via central Twilio (env vars) OR workspace Twilio (BYO override)
 *   6. Increment the counter
 */
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') ?? '')
      .replace(/^Bearer\s+/i, '')
      .trim();
    if (!token) return jsonError('Missing access token', 401);

    const { phone } = (await req.json()) as { phone?: string };
    if (!phone) return jsonError('Missing phone number', 400);

    const e164 = toE164(phone);
    if (!e164) return jsonError('Invalid UK mobile number', 400);

    const admin = createSupabaseAdminClient();

    const { data: userResult, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userResult?.user) return jsonError('Invalid session', 401);

    const { data: profile } = await admin
      .from('users')
      .select('workspace_id')
      .eq('id', userResult.user.id)
      .maybeSingle();
    if (!profile?.workspace_id) {
      return jsonError('User is not assigned to a workspace', 403);
    }

    const { data: ws, error: wsErr } = await admin
      .from('workspaces')
      .select(
        'id, name, plan, sms_used_this_period, period_start, twilio_account_sid, twilio_auth_token, twilio_from_number, sms_template'
      )
      .eq('id', profile.workspace_id)
      .maybeSingle();
    if (wsErr || !ws) return jsonError('Workspace not found', 404);

    // ---------------------------------------------------------------------
    // Roll the counter if we're in a new calendar month.
    // ---------------------------------------------------------------------
    const now = new Date();
    const periodStart = ws.period_start ? new Date(ws.period_start) : new Date(0);
    const sameMonth =
      now.getUTCFullYear() === periodStart.getUTCFullYear() &&
      now.getUTCMonth() === periodStart.getUTCMonth();
    let smsUsed = ws.sms_used_this_period ?? 0;
    if (!sameMonth) {
      smsUsed = 0;
      await admin
        .from('workspaces')
        .update({
          sms_used_this_period: 0,
          period_start: new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
          ).toISOString(),
        })
        .eq('id', ws.id);
    }

    // ---------------------------------------------------------------------
    // Enforce the plan limit.
    // ---------------------------------------------------------------------
    const plan: PlanId = ((ws.plan as PlanId) || 'free') as PlanId;
    const limit = PLAN_BY_ID[plan].sms_limit;
    if (smsUsed >= limit) {
      return NextResponse.json(
        {
          ok: false,
          error: `You've used all ${limit} SMS forms this month on the ${PLAN_BY_ID[plan].name} plan. Upgrade in Settings to send more.`,
          over_limit: true,
          plan,
          limit,
        },
        { status: 402 }
      );
    }

    // ---------------------------------------------------------------------
    // Pick Twilio creds: workspace BYO if set, otherwise central env.
    // ---------------------------------------------------------------------
    const sid =
      ws.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID || '';
    const tok =
      ws.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN || '';
    const from =
      ws.twilio_from_number || process.env.TWILIO_FROM_NUMBER || '';

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? brandUrl();
    const link = `${appUrl}/register?workspace=${ws.id}&ref=${encodeURIComponent(
      e164.replace(/^\+/, '')
    )}`;

    if (!sid || !tok || !from) {
      // No central Twilio + no BYO → dev mode (helpful during local testing).
      console.log(`[/api/send] dev mode (no Twilio) — link for ${e164}: ${link}`);
      return NextResponse.json({ ok: true, phone: e164, dev_mode: true, link });
    }

    const template =
      ws.sms_template ||
      'Hi! {practice_name} has asked you to complete a quick registration form. It only takes 1 minute 👉 {link}';
    const body = template
      .replaceAll('{practice_name}', ws.name ?? 'Your practice')
      .replaceAll('{link}', link);

    const client = twilio(sid, tok);
    await client.messages.create({ to: e164, from, body });

    // Increment the usage counter. Best-effort — if it fails, the SMS still went.
    await admin
      .from('workspaces')
      .update({ sms_used_this_period: smsUsed + 1 })
      .eq('id', ws.id);

    return NextResponse.json({ ok: true, phone: e164, used: smsUsed + 1, limit });
  } catch (err) {
    console.error('[/api/send]', err);
    return jsonError('Could not send SMS. Please try again.', 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
