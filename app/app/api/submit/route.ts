import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { channelForPhone, toE164 } from '@/lib/phone';
import { resolvePusherServer, makePusher } from '@/lib/pusher';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// Caps the public endpoint can never exceed. The patient form is small —
// dozens of fields with short values — so anything beyond these is abuse.
const MAX_FIELDS = 50;
const MAX_FIELD_LENGTH = 4_000;       // chars per field value
const MAX_TOTAL_LENGTH = 100_000;     // chars across all field values

// Per-IP: 30 submits / minute. Per-IP×workspace: 10 submits / minute. The
// first stops a single source flooding any workspace; the second stops one
// source aimed at a single workspace once they know its id.
const RL_PER_IP = 30;
const RL_PER_IP_WS = 10;

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
    const ip = clientIp(req);

    const ipGate = rateLimit(`submit:ip:${ip}`, RL_PER_IP);
    if (!ipGate.ok) {
      return tooMany(ipGate.retryAfterMs);
    }

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

    // Per-(ip, workspace) limit so an attacker who knows one workspace_id
    // can't hammer it via many IPs without also tripping the global IP limit.
    const wsGate = rateLimit(`submit:ip-ws:${ip}:${body.workspace_id}`, RL_PER_IP_WS);
    if (!wsGate.ok) {
      return tooMany(wsGate.retryAfterMs);
    }

    // Payload size/shape guards — defence in depth on top of Next's default
    // 1 MB body parser. Reject obviously hostile shapes early.
    const fieldEntries = Object.entries(body.fields);
    if (fieldEntries.length > MAX_FIELDS) {
      return jsonError('Too many fields', 400);
    }
    let totalLength = 0;
    for (const [key, value] of fieldEntries) {
      if (typeof key !== 'string' || key.length > 100) {
        return jsonError('Invalid field key', 400);
      }
      const str = value == null ? '' : String(value);
      if (str.length > MAX_FIELD_LENGTH) {
        return jsonError('Field value too long', 400);
      }
      totalLength += str.length;
      if (totalLength > MAX_TOTAL_LENGTH) {
        return jsonError('Form payload too large', 400);
      }
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

    const creds = resolvePusherServer(ws);
    if (!creds) {
      return jsonError('Realtime is not configured. Please contact support.', 400);
    }

    const pusher = makePusher(creds);

    const payload = {
      phone: e164,
      submitted_at: new Date().toISOString(),
      fields: body.fields,
    };

    await pusher.trigger(channelForPhone(e164), 'patient.registered', payload);

    // Persist for submission history. Best-effort — a storage hiccup must not
    // fail the patient's submission (they've already filled it in).
    try {
      await admin.from('submissions').insert({
        workspace_id: ws.id,
        phone: e164,
        fields: body.fields,
      });
    } catch (storeErr) {
      console.error('[/api/submit] history insert failed', storeErr);
    }

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

function tooMany(retryAfterMs: number) {
  return NextResponse.json(
    { ok: false, error: 'Too many requests. Please wait a moment and try again.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) },
    }
  );
}
