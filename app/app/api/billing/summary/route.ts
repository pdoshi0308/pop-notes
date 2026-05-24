import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { getStripe, stripeConfigured } from '@/lib/stripe';

export const runtime = 'nodejs';

/**
 * GET /api/billing/summary
 * Returns the live billing snapshot the dashboard needs:
 *   - plan + status (active / past_due / canceled)
 *   - next charge date + amount (or "cancels on …")
 *   - card brand + last4
 *   - last 3 invoices with hosted + pdf URLs
 *
 * Anything missing (e.g. no Stripe customer yet) is returned as null so
 * the UI can degrade cleanly without throwing.
 */
export async function GET(req: NextRequest) {
  try {
    if (!stripeConfigured()) {
      return NextResponse.json({ ok: true, summary: null });
    }

    const token = (req.headers.get('authorization') ?? '')
      .replace(/^Bearer\s+/i, '')
      .trim();
    if (!token) return jsonError('Missing access token', 401);

    const admin = createSupabaseAdminClient();
    const { data: userResult } = await admin.auth.getUser(token);
    const caller = userResult?.user;
    if (!caller) return jsonError('Invalid session', 401);

    const { data: profile } = await admin
      .from('users')
      .select('workspace_id')
      .eq('id', caller.id)
      .maybeSingle();
    if (!profile?.workspace_id) return jsonError('No workspace', 403);

    const { data: ws } = await admin
      .from('workspaces')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', profile.workspace_id)
      .maybeSingle();
    if (!ws?.stripe_customer_id) {
      return NextResponse.json({ ok: true, summary: null });
    }

    const stripe = getStripe()!;

    const [subscription, invoices, customer] = await Promise.all([
      ws.stripe_subscription_id
        ? stripe.subscriptions
            .retrieve(ws.stripe_subscription_id, { expand: ['default_payment_method'] })
            .catch(() => null)
        : Promise.resolve(null),
      stripe.invoices.list({ customer: ws.stripe_customer_id, limit: 3 }),
      stripe.customers.retrieve(ws.stripe_customer_id).catch(() => null),
    ]);

    const card = cardFrom(subscription, customer);
    const sub = subscription;

    const nextChargeAmount =
      sub?.items.data[0]?.price.unit_amount != null
        ? sub.items.data[0].price.unit_amount / 100
        : null;
    const nextChargeCurrency = sub?.items.data[0]?.price.currency?.toUpperCase() ?? null;

    return NextResponse.json({
      ok: true,
      summary: {
        status: sub?.status ?? null,
        cancel_at_period_end: sub?.cancel_at_period_end ?? false,
        current_period_end: sub?.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        next_charge_amount: nextChargeAmount,
        next_charge_currency: nextChargeCurrency,
        card,
        invoices: (invoices?.data ?? []).map((inv) => ({
          id: inv.id,
          amount_paid: inv.amount_paid / 100,
          currency: inv.currency.toUpperCase(),
          status: inv.status,
          hosted_invoice_url: inv.hosted_invoice_url,
          invoice_pdf: inv.invoice_pdf,
          created: new Date(inv.created * 1000).toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error('[/api/billing/summary]', err);
    return jsonError('Could not load billing summary', 500);
  }
}

function cardFrom(
  sub: Stripe.Subscription | null,
  customer:
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | null
): { brand: string; last4: string } | null {
  const pm = sub?.default_payment_method;
  if (pm && typeof pm !== 'string' && pm.card) {
    return { brand: pm.card.brand, last4: pm.card.last4 };
  }
  if (customer && !('deleted' in customer && customer.deleted)) {
    const c = customer as Stripe.Customer;
    const src = c.invoice_settings?.default_payment_method;
    if (src && typeof src !== 'string' && src.card) {
      return { brand: src.card.brand, last4: src.card.last4 };
    }
  }
  return null;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
