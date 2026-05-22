import Link from 'next/link';
import { BRAND } from '@/lib/brand';

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-brand-bg/80 border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent" />
          {BRAND.name}
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {BRAND.nav.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-brand-primary transition">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/login" className="btn-ghost hidden sm:inline-flex">
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary !py-2 text-sm">
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 mt-24">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-gradient-to-br from-brand-primary to-brand-accent" />
          <span className="font-semibold text-slate-700">{BRAND.name}</span>
          <span>·</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/privacy" className="hover:text-brand-primary transition">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-brand-primary transition">
            Terms
          </Link>
          <a
            href={`mailto:${BRAND.supportEmail}`}
            className="hover:text-brand-primary transition"
          >
            {BRAND.supportEmail}
          </a>
        </div>
      </div>
    </footer>
  );
}
