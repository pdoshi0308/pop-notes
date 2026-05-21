import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { toE164 } from '@/lib/phone';

export const runtime = 'nodejs';

/**
 * POST /api/send
 * Body: { phone: string }
 * Headers: Authorization: Bearer <Supabase access_token>
 *
 * Validates the JWT, looks up the caller's workspace + Twilio creds, then
 * sends the configured SMS to the patient.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return jsonError('Missing access token', 401);

    const { phone } = (await req.json()) as { phone?: string };
    if (!phone) return jsonError('Missing phone number', 400);

    const e164 = toE164(phone);
    if (!e164) return jsonError('Invalid UK mobile number', 400);

    const admin = createSupabaseAdminClient();

    // Validate the Supabase JWT by asking Supabase to resolve the user.
    const { data: userResult, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userResult?.user) return jsonError('Invalid session', 401);

    const userId = userResult.user.id;

    // Get the caller's workspace + Twilio creds.
    const { data: profile, error: profileErr } = await admin
      .from('users')
      .select('workspace_id')
      .eq('id', userId)
      .maybeSingle();
    if (profileErr || !profile?.workspace_id) {
      return jsonError('User is not assigned to a workspace', 403);
    }

    const { data: ws, error: wsErr } = await admin
      .from('workspaces')
      .select(
        'id, name, twilio_account_sid, twilio_auth_token, twilio_from_number, sms_template'
      )
      .eq('id', profile.workspace_id)
      .maybeSingle();
    if (wsErr || !ws) return jsonError('Workspace not found', 404);

    if (!ws.twilio_account_sid || !ws.twilio_auth_token || !ws.twilio_from_number) {
      return jsonError(
        'Twilio credentials are not set up for this workspace yet. Visit Settings in the dashboard.',
        400
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://popform.io';
    const link = `${appUrl}/register?workspace=${ws.id}&ref=${encodeURIComponent(
      e164.replace(/^\+/, '')
    )}`;

    const template =
      ws.sms_template ||
      'Hi! {practice_name} has asked you to complete a quick registration form. It only takes 1 minute 👉 {link}';
    const body = template
      .replaceAll('{practice_name}', ws.name ?? 'Your practice')
      .replaceAll('{link}', link);

    const client = twilio(ws.twilio_account_sid, ws.twilio_auth_token);
    await client.messages.create({
      to: e164,
      from: ws.twilio_from_number,
      body,
    });

    return NextResponse.json({ ok: true, phone: e164 });
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
