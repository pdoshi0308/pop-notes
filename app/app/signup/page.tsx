import type { Metadata } from 'next';
import { Suspense } from 'react';
import SignupClient from './signup-client';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Start free',
  description: `Create your ${BRAND.name} account — free for your first 10 SMS forms a month. No card required.`,
  alternates: { canonical: '/signup' },
};

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupClient />
    </Suspense>
  );
}
