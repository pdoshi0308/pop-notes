'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-brand-bg">
      <div className="card w-full max-w-md p-8 text-center animate-pop-in">
        <div className="flex items-center gap-2 font-extrabold text-lg tracking-tight justify-center">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent" />
          {BRAND.name}
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sorry about that. Try again, and if it keeps happening let us know.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-slate-400 font-mono">Ref: {error.digest}</p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button className="btn-secondary" onClick={reset}>Try again</button>
          <Link href="/dashboard" className="btn-primary">Back to dashboard</Link>
        </div>
      </div>
    </main>
  );
}
