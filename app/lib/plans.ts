/**
 * Plan / tier definitions. Single source of truth — landing pricing,
 * Stripe Checkout, /api/send rate limit, and the in-extension billing
 * widget all read from here.
 *
 * To launch in production: replace the `stripePriceId` placeholders with
 * the real price IDs from the Stripe dashboard (test-mode first, then
 * swap for live).
 */

export type PlanId = 'free' | 'starter' | 'pro' | 'practice';

export interface Plan {
  id: PlanId;
  name: string;
  price_gbp: number;
  /** SMS allowance per billing period (calendar month). */
  sms_limit: number;
  /** Optional Stripe price ID — paste from the Stripe dashboard. */
  stripePriceId?: string;
  /** Tagline shown on the pricing card. */
  tagline: string;
  /** Bulleted feature list. */
  features: string[];
  /** Highlights as the "recommended" plan on the pricing grid. */
  recommended?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price_gbp: 0,
    sms_limit: 10,
    tagline: 'Try it on a few clients',
    features: [
      '10 SMS forms / month',
      'Real-time submissions in Chrome',
      'Customisable form fields',
      'Unlimited team members',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price_gbp: 29,
    sms_limit: 150,
    stripePriceId: process.env.STRIPE_PRICE_STARTER,
    tagline: 'For small businesses',
    features: [
      '150 SMS forms / month',
      'Everything in Free',
      'Saved submission history',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price_gbp: 79,
    sms_limit: 500,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    tagline: 'For busy teams',
    features: [
      '500 SMS forms / month',
      'Everything in Starter',
      'Priority email support',
    ],
    recommended: true,
  },
  {
    id: 'practice',
    name: 'Business',
    price_gbp: 149,
    sms_limit: 1500,
    stripePriceId: process.env.STRIPE_PRICE_PRACTICE,
    tagline: 'For larger groups',
    features: [
      '1,500 SMS forms / month',
      'Everything in Pro',
      'Phone support',
      'Dedicated onboarding call',
    ],
  },
];

export const PLAN_BY_ID: Record<PlanId, Plan> = Object.fromEntries(
  PLANS.map((p) => [p.id, p])
) as Record<PlanId, Plan>;

export const DEFAULT_PLAN: PlanId = 'free';

/** True when the workspace is over its SMS allowance for the current period. */
export function isOverLimit(plan: PlanId, smsUsed: number): boolean {
  return smsUsed >= PLAN_BY_ID[plan].sms_limit;
}

/** Friendly "150 / 500" style string for the usage UI. */
export function formatUsage(plan: PlanId, smsUsed: number): string {
  return `${smsUsed.toLocaleString()} / ${PLAN_BY_ID[plan].sms_limit.toLocaleString()}`;
}
