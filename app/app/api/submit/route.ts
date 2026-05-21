import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { channelForPhone, toE164 } from '@/lib/phone';

export const runtime = 'nodejs';

/**
 * POST /api/submit
 * Body: { workspace_id, phone, fields: { [field_id]: value } }
 *
 * Public endpoint — the patient submits this from their phone after filling
 * in the registration form. We trigger a Pusher event so the receptionist
 * who sent the SMS sees the data instantly inside the Chrome extension.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      workspace_id?: string;
      phone?: string;
      fields?: Record<string, unknown>;
    };

    if (!body.workspace_id) return jsonError('Missing workspace_id', 400);
    if (!body.phone) return jsonError('Missing phone', 400);
    if (!body.fields || typeof body.fields !== 'object') {
      return jsonError('Missing fields', 400);
    }

    const e164 = toE164(body.phone);
    if (!e164) return jsonError('Invalid phone format', 400);

    const admin = createSupabaseAdminClient();
    const { data: ws, error: wsErr } = await admin
      .from('workspaces')
      .select('id, name, pusher_app_id, pusher_key, pusher_secret, pusher_cluster')
      .eq('id', body.workspace_id)
      .maybeSingle();
    if (wsErr || !ws) return jsonError('Workspace not found', 404);

    if (!ws.pusher_app_id || !ws.pusher_key || !ws.pusher_secret || !ws.pusher_cluster) {
      return jsonError(
        'Realtime credentials are not configured for this workspace.',
        400
      );
    }

    const pusher = new Pusher({
      appId: ws.pusher_app_id,
      key: ws.pusher_key,
      secret: ws.pusher_secret,
      cluster: ws.pusher_cluster,
      useTLS: true,
    });

    const payload = {
      phone: e164,
      submitted_at: new Date().toISOString(),
      fields: body.fields,
    };

    await pusher.trigger(channelForPhone(e164), 'patient.registered', payload);

    return NextResponse.json({ ok: true, practice_name: ws.name });
  } catch (err) {
    console.error('[/api/submit]', err);
    return jsonError('Could not submit form. Please try again.', 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
