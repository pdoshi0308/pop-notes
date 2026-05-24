import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { toE164 } from '@/lib/phone';
import { PLAN_BY_ID, type PlanId } from '@/lib/plans';
import { brandUrl } from '@/lib/brand';

export const runtime = 'nodejs';

/**
 * POST /api/send  { phone, channel?: 'sms' | 'whatsapp' }
 * Headers: Authorization: Bearer <Supabase access_token>
 *
 * Sends the registration link over SMS or WhatsApp via Twilio. When the
 * requested channel isn't configured (no Twilio / no WhatsApp sender) it
 * returns { manual: true, link } so the caller can share the link by hand.
 */
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') ?? '')
      .replace(/^Bearer\s+/i, '')
      .trim();
    if (!token) return jsonError('Missing access token', 401);

    const { phone, channel: rawChannel } = (await req.json()) as {
      phone?: string;
      channel?: string;
    };
    if (!phone) return jsonError('Missing phone number', 400);
    const channel: 'sms' | 'whatsapp' = rawChannel === 'whatsapp' ? 'whatsapp' : 'sms';

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
        'id, name, plan, twilio_account_sid, twilio_auth_token, twilio_from_number, sms_template'
      )
      .eq('id', profile.workspace_id)
      .maybeSingle();
    if (wsErr || !ws) return jsonError('Workspace not found', 404);

    const plan: PlanId = ((ws.plan as PlanId) || 'free') as PlanId;
    const limit = PLAN_BY_ID[plan].sms_limit;

    // ---------------------------------------------------------------------
    // Pick Twilio creds: workspace BYO if set, otherwise central env.
    // ---------------------------------------------------------------------
    const sid = ws.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID || '';
    const tok = ws.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN || '';
    const from = ws.twilio_from_number || process.env.TWILIO_FROM_NUMBER || '';
    // WhatsApp sender + optional approved template (central only).
    const waFrom = (process.env.TWILIO_WHATSAPP_FROM || '').replace(/^whatsapp:/, '');
    const waContentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID || '';

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? brandUrl();
    const link = `${appUrl}/register?workspace=${ws.id}&ref=${encodeURIComponent(
      e164.replace(/^\+/, '')
    )}`;

    // Can we actually send automatically on the requested channel?
    const canSend =
      channel === 'whatsapp' ? Boolean(sid && tok && waFrom) : Boolean(sid && tok && from);

    if (!canSend) {
      // Not configured → hand the link back so the caller shares it manually
      // (WhatsApp click-to-send, or the dev-mode link during local testing).
      return NextResponse.json({
        ok: true,
        phone: e164,
        channel,
        manual: true,
        dev_mode: channel === 'sms',
        link,
      });
    }

    // Atomically check the limit AND reserve a credit. The Postgres function
    // takes a row lock on the workspace, so two concurrent /api/send calls
    // serialise here instead of both reading the same `used` value and both
    // passing the limit check (the bug we used to have).
    const { data: reserveRow, error: reserveErr } = await admin.rpc(
      'increment_sms_usage',
      { p_workspace_id: ws.id, p_limit: limit }
    );
    if (reserveErr) {
      console.error('[/api/send] reserve failed', reserveErr);
      return jsonError('Could not reserve SMS credit', 500);
    }
    const reserve = Array.isArray(reserveRow) ? reserveRow[0] : reserveRow;
    if (!reserve?.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `You've used all ${limit} forms this month on the ${PLAN_BY_ID[plan].name} plan. Upgrade in Settings to send more.`,
          over_limit: true,
          plan,
          limit,
        },
        { status: 402 }
      );
    }
    const smsUsed = (reserve.used as number) - 1; // value before increment, for parity with the old response shape

    const template =
      ws.sms_template ||
      'Hi! {practice_name} has asked you to complete a quick registration form. It only takes 1 minute 👉 {link}';
    const body = template
      .replaceAll('{business_name}', ws.name ?? 'Your business')
      .replaceAll('{practice_name}', ws.name ?? 'Your business')
      .replaceAll('{link}', link);

    const client = twilio(sid, tok);
    try {
      if (channel === 'whatsapp') {
        const waTo = `whatsapp:${e164}`;
        const waFromAddr = `whatsapp:${waFrom}`;
        if (waContentSid) {
          // Business-initiated chats need a Meta-approved template.
          await client.messages.create({
            from: waFromAddr,
            to: waTo,
            contentSid: waContentSid,
            contentVariables: JSON.stringify({ '1': link }),
          });
        } else {
          // Works inside the 24h session window / Twilio sandbox.
          await client.messages.create({ from: waFromAddr, to: waTo, body });
        }
      } else {
        await client.messages.create({ to: e164, from, body });
      }
    } catch (twErr) {
      // Twilio said no after we already reserved a credit — refund it so the
      // user's monthly counter doesn't get burned for a message that never
      // went out.
      try {
        await admin
          .from('workspaces')
          .update({ sms_used_this_period: smsUsed })
          .eq('id', ws.id);
      } catch (refundErr) {
        console.error('[/api/send] refund failed', refundErr);
      }
      const code = (twErr as { code?: number })?.code;
      const raw = (twErr as { message?: string })?.message ?? 'request rejected';
      console.error(`[/api/send] Twilio ${channel} error`, code, raw);
      const hint =
        code === 20003
          ? 'Twilio rejected the credentials (auth failed). Check the Account SID (must start with "AC") and Auth Token.'
          : code === 63007
          ? 'No WhatsApp sender is set up for that Twilio number — check TWILIO_WHATSAPP_FROM.'
          : code === 63016
          ? 'WhatsApp needs a Meta-approved template to start a chat. Set TWILIO_WHATSAPP_CONTENT_SID to your approved template SID.'
          : code === 21608
          ? 'This number is unverified. Twilio trial accounts can only message numbers you have verified.'
          : code === 21606 || code === 21659 || code === 21210
          ? 'Your Twilio "from" number cannot message this destination. Use a capable sender on your account.'
          : code === 21211 || code === 21614
          ? 'That is not a valid phone number.'
          : `Message provider error (${code ?? 'unknown'}): ${raw}`;
      return NextResponse.json({ ok: false, error: hint, provider_code: code }, { status: 502 });
    }

    // Credit was already reserved atomically above — nothing else to write.
    return NextResponse.json({ ok: true, phone: e164, channel, used: reserve.used, limit });
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
