import { Suspense } from 'react';
import RegisterClient from './register-client';

// Server wrapper so that searchParams are easy to type and we can stream the
// initial config fetch from the client (no auth, no cookies — fine to keep
// client-side for now to maximise edge cacheability later).
export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-brand-bg flex flex-col">
      <Suspense fallback={null}>
        <RegisterClient />
      </Suspense>
      <footer className="text-center text-xs text-slate-400 py-6">
        Powered by{' '}
        <span className="font-semibold text-slate-500">Popform</span>
      </footer>
    </main>
  );
}
