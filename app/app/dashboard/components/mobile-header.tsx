'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import NavLinks from './nav-links';
import SignOutButton from './sign-out-button';
import { BRAND } from '@/lib/brand';

export default function MobileHeader({
  role,
  fullName,
  email,
  workspaceName,
}: {
  role: string;
  fullName: string;
  email: string;
  workspaceName: string;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <Link href="/dashboard" className="flex items-center gap-2 font-extrabold text-base tracking-tight">
          <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent" />
          {BRAND.name}
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-2 -mr-2 rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40"
          onClick={() => setOpen(false)}
        >
          <aside
            className="absolute right-0 top-0 h-full w-72 max-w-[85%] bg-white flex flex-col shadow-xl animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="font-extrabold text-base">{BRAND.name}</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{workspaceName}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 -mr-2 rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <NavLinks role={role} onNavigate={() => setOpen(false)} />

            <div className="mt-auto p-4 border-t border-slate-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
                  {(fullName || email || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="text-xs flex-1 min-w-0">
                  <p className="font-medium truncate">{fullName || email}</p>
                  <p className="text-slate-500 truncate">{email}</p>
                </div>
              </div>
              <SignOutButton withLabel />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
