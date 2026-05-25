import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import SignupClient from './signup-client';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Start free',
  description: `Create your ${BRAND.name} account — free for your first 10 SMS forms a month. No card required.`,
  alternates: { canonical: '/signup' },
};

export default async function SignupPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.workspace_id) redirect('/dashboard');
  }
  return (
    <Suspense fallback={null}>
      <SignupClient />
    </Suspense>
  );
}
