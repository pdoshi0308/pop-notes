import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { getStripe, stripeConfigured } from '@/lib/stripe';

export const runtime = 'nodejs';

/**
 * POST /api/customer-portal
 * Returns a Stripe Customer Portal URL so the admin can manage / cancel
 * their subscription, update card, download invoices.
 */
export async function POST(req: NextRequest) {
  try {
    if (!stripeConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'Billing is not configured yet.' },
        { status: 503 }
      );
    }

    const token = (req.headers.get('authorization') ?? '')
      .replace(/^Bearer\s+/i, '')
      .trim();
    if (!token) return jsonError('Missing access token', 401);

    const admin = createSupabaseAdminClient();
    const { data: userResult } = await admin.auth.getUser(token);
    if (!userResult?.user) return jsonError('Invalid session', 401);

    const { data: profile } = await admin
      .from('users')
      .select('workspace_id, role')
      .eq('id', userResult.user.id)
      .maybeSingle();
    if (!profile?.workspace_id) return jsonError('No workspace', 403);
    if (profile.role !== 'admin') return jsonError('Admins only', 403);

    const { data: ws } = await admin
      .from('workspaces')
      .select('stripe_customer_id')
      .eq('id', profile.workspace_id)
      .maybeSingle();
    if (!ws?.stripe_customer_id) {
      return jsonError('No Stripe customer yet — start a subscription first.', 400);
    }

    const stripe = getStripe()!;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://popform.io';
    const portal = await stripe.billingPortal.sessions.create({
      customer: ws.stripe_customer_id,
      return_url: `${appUrl}/dashboard`,
    });

    return NextResponse.json({ ok: true, url: portal.url });
  } catch (err) {
    console.error('[/api/customer-portal]', err);
    return jsonError('Could not start portal', 500);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
