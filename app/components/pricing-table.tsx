'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { PLANS } from '@/lib/plans';

export function PricingTable() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      {PLANS.map((plan) => {
        const isFree = plan.id === 'free';
        return (
          <div
            key={plan.id}
            className={[
              'card p-6 flex flex-col relative',
              plan.recommended
                ? 'border-brand-primary ring-2 ring-rose-100'
                : '',
            ].join(' ')}
          >
            {plan.recommended && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-brand-primary text-white text-xs font-semibold">
                Most popular
              </span>
            )}
            <h3 className="text-xl font-bold">{plan.name}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{plan.tagline}</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold">£{plan.price_gbp}</span>
              <span className="text-sm text-slate-500">/mo</span>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-slate-700 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-brand-success mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={isFree ? '/signup' : `/signup?plan=${plan.id}`}
              className={[
                'mt-6 inline-flex items-center justify-center py-3 rounded-xl font-semibold text-sm transition',
                plan.recommended
                  ? 'bg-brand-primary text-white hover:bg-rose-700'
                  : 'bg-white border border-slate-200 hover:border-slate-300',
              ].join(' ')}
            >
              {isFree ? 'Start free' : `Choose ${plan.name}`}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
