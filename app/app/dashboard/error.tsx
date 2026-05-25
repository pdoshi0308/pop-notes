'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard/error]', error);
  }, [error]);

  return (
    <div className="px-6 md:px-8 py-12 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="text-slate-600 mt-2">
        We couldn&apos;t load this page. Try again, and if it keeps happening let us know.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-slate-400 font-mono">Ref: {error.digest}</p>
      )}
      <div className="mt-6 flex items-center gap-3">
        <button className="btn-secondary" onClick={reset}>Try again</button>
        <Link href="/dashboard" className="btn-primary">Back to dashboard</Link>
      </div>
    </div>
  );
}
