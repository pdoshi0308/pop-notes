import { Suspense } from 'react';
import RegisterClient from './register-client';

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-brand-bg flex flex-col">
      <Suspense fallback={null}>
        <RegisterClient />
      </Suspense>

      {/* Branded footer — visible to every patient who fills the form.
          The CTA only shows on the patient form itself, not so loud as to
          distract from the practice's own brand at the top. */}
      <footer className="px-5 pt-6 pb-8 flex flex-col items-center gap-1.5"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)' }}>
        <a
          href="https://popform.io"
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
            Popform
          </span>
        </a>
        <p className="text-[11px] text-slate-400">SMS patient forms for UK practices</p>
      </footer>
    </main>
  );
}
