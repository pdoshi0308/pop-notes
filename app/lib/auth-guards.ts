import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './supabase-server';

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard/login');
  return { supabase, user };
}

export async function requireMember() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id, role, full_name')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.workspace_id) redirect('/dashboard/login?error=no_workspace');
  return { supabase, user, profile };
}

export async function requireAdmin() {
  const { supabase, user, profile } = await requireMember();
  if (profile.role !== 'admin') redirect('/dashboard');
  return { supabase, user, profile };
}
