import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth-guards';
import BillingClient from './billing-client';
import { PLAN_BY_ID, type PlanId } from '@/lib/plans';

export default async function BillingPage() {
  const { supabase, profile } = await requireAdmin();

  const { data: ws } = await supabase
    .from('workspaces')
    .select(
      'name, plan, sms_used_this_period, period_start, stripe_subscription_id, stripe_customer_id, cancel_at_period_end, current_period_end'
    )
    .eq('id', profile.workspace_id)
    .maybeSingle();
  if (!ws) redirect('/dashboard/login?error=no_workspace');

  const plan: PlanId = ((ws.plan as PlanId) || 'free') as PlanId;
  return (
    <BillingClient
      isAdmin={true}
      currentPlan={plan}
      smsUsed={ws.sms_used_this_period ?? 0}
      smsLimit={PLAN_BY_ID[plan].sms_limit}
      hasActiveSubscription={!!ws.stripe_subscription_id}
      hasCustomer={!!ws.stripe_customer_id}
      cancelAtPeriodEnd={!!ws.cancel_at_period_end}
      currentPeriodEnd={ws.current_period_end}
    />
  );
}
