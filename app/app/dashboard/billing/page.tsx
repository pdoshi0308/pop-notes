import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import BillingClient from './billing-client';
import { PLAN_BY_ID, type PlanId } from '@/lib/plans';

export default async function BillingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');

  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.workspace_id) redirect('/dashboard/login?error=no_workspace');

  const { data: ws } = await supabase
    .from('workspaces')
    .select(
      'name, plan, sms_used_this_period, period_start, stripe_subscription_id'
    )
    .eq('id', profile.workspace_id)
    .maybeSingle();
  if (!ws) redirect('/dashboard/login?error=no_workspace');

  const plan: PlanId = ((ws.plan as PlanId) || 'free') as PlanId;
  return (
    <BillingClient
      isAdmin={profile.role === 'admin'}
      currentPlan={plan}
      smsUsed={ws.sms_used_this_period ?? 0}
      smsLimit={PLAN_BY_ID[plan].sms_limit}
      hasActiveSubscription={!!ws.stripe_subscription_id}
    />
  );
}
