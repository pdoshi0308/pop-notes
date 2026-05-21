import { Suspense } from 'react';
import RegisterClient from './register-client';
import { BRAND, brandUrl } from '@/lib/brand';

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-brand-bg flex flex-col">
      <Suspense fallback={null}>
        <RegisterClient />
      </Suspense>

      <footer
        className="px-5 pt-6 pb-8 flex flex-col items-center gap-1.5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)' }}
      >
        <a
          href={brandUrl()}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-primary transition group"
        >
          <span
            className="w-3.5 h-3.5 rounded-[4px] bg-gradient-to-br from-brand-primary to-brand-accent
                       shadow-sm group-hover:scale-110 transition"
          />
          Powered by{' '}
          <span className="font-semibold text-slate-700 group-hover:text-brand-primary transition">
            {BRAND.name}
          </span>
        </a>
        <p className="text-[11px] text-slate-400">{BRAND.tagline}</p>
      </footer>
    </main>
  );
}
