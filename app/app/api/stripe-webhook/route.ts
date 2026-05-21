import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { PLANS, type PlanId } from '@/lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe-webhook
 * Verifies the Stripe signature, then updates `workspaces.plan` based on
 * subscription events.
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ ok: false, error: 'Not configured' }, { status: 503 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ ok: false }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error('[stripe-webhook] signature failure:', err);
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const workspaceId = (s.metadata?.workspace_id as string) ?? s.client_reference_id;
        const plan = (s.metadata?.plan as PlanId) ?? 'starter';
        if (workspaceId) {
          await admin
            .from('workspaces')
            .update({
              plan,
              stripe_customer_id: (s.customer as string) ?? null,
              stripe_subscription_id: (s.subscription as string) ?? null,
            })
            .eq('id', workspaceId);
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        const workspaceId = sub.metadata?.workspace_id as string | undefined;
        const priceId = sub.items.data[0]?.price.id;
        const plan = PLANS.find((p) => p.stripePriceId === priceId)?.id;
        if (workspaceId && plan) {
          await admin
            .from('workspaces')
            .update({
              plan,
              stripe_customer_id: sub.customer as string,
              stripe_subscription_id: sub.id,
            })
            .eq('id', workspaceId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const workspaceId = sub.metadata?.workspace_id as string | undefined;
        if (workspaceId) {
          await admin
            .from('workspaces')
            .update({ plan: 'free', stripe_subscription_id: null })
            .eq('id', workspaceId);
        }
        break;
      }
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
