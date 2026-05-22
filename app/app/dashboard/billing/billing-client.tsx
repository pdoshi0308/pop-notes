'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { PLANS, type PlanId } from '@/lib/plans';

export default function BillingClient({
  isAdmin,
  currentPlan,
  smsUsed,
  smsLimit,
  hasActiveSubscription,
}: {
  isAdmin: boolean;
  currentPlan: PlanId;
  smsUsed: number;
  smsLimit: number;
  hasActiveSubscription: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function getToken(): Promise<string | null> {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function startCheckout(plan: PlanId) {
    setError(null);
    setBusy(plan);
    try {
      const token = await getToken();
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Checkout failed');
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout');
      setBusy(null);
    }
  }

  async function openPortal() {
    setError(null);
    setBusy('portal');
    try {
      const token = await getToken();
      const res = await fetch('/api/customer-portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not open portal');
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open portal');
      setBusy(null);
    }
  }

  const usagePct = Math.min(100, Math.round((smsUsed / Math.max(smsLimit, 1)) * 100));

  return (
    <div className="px-8 py-10 max-w-6xl">
      <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
      <p className="text-slate-600 mt-1">
        Manage your subscription and SMS usage.
      </p>

      {/* Current plan card */}
      <div className="card p-6 mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
            Current plan
          </p>
          <p className="text-2xl font-bold mt-1">
            {PLANS.find((p) => p.id === currentPlan)?.name ?? currentPlan}
          </p>
        </div>
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              SMS this month
            </p>
            <p className="text-xs font-mono text-slate-500">
              {smsUsed} / {smsLimit}
            </p>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full transition-all ${
                usagePct >= 90 ? 'bg-brand-error' : 'bg-brand-primary'
              }`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>
        {hasActiveSubscription && isAdmin && (
          <button
            className="btn-secondary"
            onClick={openPortal}
            disabled={busy === 'portal'}
          >
            {busy === 'portal' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Manage subscription'
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-brand-error font-medium">{error}</p>
      )}

      {/* Plans */}
      <h2 className="text-base font-semibold mt-10">Change plan</h2>
      <p className="text-sm text-slate-500">
        Pick the right monthly SMS allowance for your business.
      </p>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
        {PLANS.map((plan) => {
          const active = plan.id === currentPlan;
          const isFree = plan.id === 'free';
          return (
            <div
              key={plan.id}
              className={[
                'card p-5 flex flex-col',
                active ? 'border-brand-primary ring-2 ring-rose-100' : '',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{plan.name}</h3>
                {active && (
                  <span className="text-xs font-semibold text-brand-primary">
                    Current
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{plan.tagline}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold">£{plan.price_gbp}</span>
                <span className="text-xs text-slate-500">/mo</span>
              </div>
              <ul className="mt-4 space-y-1.5 text-xs text-slate-700 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-brand-success mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {!active && (
                <button
                  className="btn-primary mt-5 !py-2.5 text-sm"
                  disabled={!isAdmin || busy === plan.id || isFree}
                  onClick={() => !isFree && startCheckout(plan.id)}
                  title={isFree ? 'Already free' : ''}
                >
                  {busy === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isFree ? (
                    'Free'
                  ) : (
                    `Upgrade to ${plan.name}`
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!isAdmin && (
        <p className="mt-6 text-sm text-slate-500">
          Only admins can change the billing plan.
        </p>
      )}
    </div>
  );
}
