import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { brandUrl } from '@/lib/brand';

export const runtime = 'nodejs';

/**
 * POST /api/team/password
 *   { user_id, mode: 'reset' }            — email the teammate a reset link
 *   { user_id, mode: 'set', password }    — set their password directly
 *
 * Admin-only. Target must live in the caller's workspace. Admins can't
 * use this on themselves (use /dashboard/account instead). Both modes
 * leave the teammate's account otherwise untouched.
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

    const { data: callerProfile } = await admin
      .from('users')
      .select('workspace_id, role')
      .eq('id', caller.id)
      .maybeSingle();
    if (!callerProfile?.workspace_id) return jsonError('No workspace', 403);
    if (callerProfile.role !== 'admin') return jsonError('Admins only', 403);

    const body = (await req.json()) as {
      user_id?: string;
      mode?: 'reset' | 'set';
      password?: string;
    };
    if (!body.user_id) return jsonError('Missing user_id', 400);
    if (body.user_id === caller.id) {
      return jsonError(
        'Use /dashboard/account to change your own password.',
        400
      );
    }
    if (body.mode !== 'reset' && body.mode !== 'set') {
      return jsonError('mode must be "reset" or "set"', 400);
    }

    // Make sure the target is in the caller's workspace.
    const { data: targetProfile } = await admin
      .from('users')
      .select('id, workspace_id')
      .eq('id', body.user_id)
      .maybeSingle();
    if (!targetProfile || targetProfile.workspace_id !== callerProfile.workspace_id) {
      return jsonError('User is not in your workspace', 404);
    }

    // Look up their email — we need it for the reset link.
    const { data: targetAuth, error: lookupErr } = await admin.auth.admin.getUserById(
      body.user_id
    );
    if (lookupErr || !targetAuth?.user?.email) {
      return jsonError('Could not look up that user', 400);
    }
    const email = targetAuth.user.email;

    if (body.mode === 'reset') {
      // generateLink with type=recovery also emails the link to the user
      // (Supabase auth sends through configured SMTP), which is exactly
      // what we want — they get the same flow as clicking "Forgot password".
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? brandUrl();
      const { error } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${appUrl}/dashboard/reset` },
      });
      if (error) return jsonError(error.message, 400);
      return NextResponse.json({ ok: true, sent_to: email });
    }

    // mode === 'set'
    if (!body.password || body.password.length < 6) {
      return jsonError('Password must be at least 6 characters', 400);
    }
    const { error } = await admin.auth.admin.updateUserById(body.user_id, {
      password: body.password,
    });
    if (error) return jsonError(error.message, 400);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/team/password]', err);
    return jsonError('Could not update password', 500);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
