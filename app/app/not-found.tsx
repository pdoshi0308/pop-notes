import Link from 'next/link';
import { BRAND } from '@/lib/brand';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-brand-bg">
      <div className="card w-full max-w-md p-8 text-center animate-pop-in">
        <div className="flex items-center gap-2 font-extrabold text-lg tracking-tight justify-center">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent" />
          {BRAND.name}
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          The page you were looking for doesn&apos;t exist or has moved.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/" className="btn-secondary">Go home</Link>
          <Link href="/dashboard" className="btn-primary">Open dashboard</Link>
        </div>
      </div>
    </main>
  );
}
