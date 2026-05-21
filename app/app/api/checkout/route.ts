import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { getStripe, stripeConfigured } from '@/lib/stripe';
import { PLAN_BY_ID, type PlanId } from '@/lib/plans';

export const runtime = 'nodejs';

/**
 * POST /api/checkout { plan: PlanId }
 * Headers: Authorization: Bearer <Supabase access_token>
 *
 * Creates a Stripe Checkout session for the chosen plan and returns its URL.
 * Front-end redirects the user there. On payment success Stripe sends a
 * webhook to /api/stripe-webhook which updates the workspace's `plan`.
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

    const { plan } = (await req.json()) as { plan?: PlanId };
    if (!plan || !PLAN_BY_ID[plan]) return jsonError('Unknown plan', 400);
    if (plan === 'free') return jsonError('Free plan does not need checkout', 400);

    const priceId = PLAN_BY_ID[plan].stripePriceId;
    if (!priceId) {
      return jsonError(`Stripe price ID for ${plan} is not configured.`, 500);
    }

    const admin = createSupabaseAdminClient();
    const { data: userResult } = await admin.auth.getUser(token);
    const user = userResult?.user;
    if (!user) return jsonError('Invalid session', 401);

    const { data: profile } = await admin
      .from('users')
      .select('workspace_id, role')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile?.workspace_id) return jsonError('No workspace', 403);
    if (profile.role !== 'admin') return jsonError('Admins only', 403);

    const { data: ws } = await admin
      .from('workspaces')
      .select('id, stripe_customer_id')
      .eq('id', profile.workspace_id)
      .maybeSingle();
    if (!ws) return jsonError('Workspace not found', 404);

    const stripe = getStripe()!;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://popform.io';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: ws.stripe_customer_id ?? undefined,
      customer_email: ws.stripe_customer_id ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?billing=success`,
      cancel_url: `${appUrl}/dashboard?billing=cancelled`,
      // Pass the workspace id so the webhook can find it.
      client_reference_id: ws.id,
      subscription_data: {
        metadata: { workspace_id: ws.id, plan },
      },
      metadata: { workspace_id: ws.id, plan },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err) {
    console.error('[/api/checkout]', err);
    return jsonError('Could not start checkout', 500);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
