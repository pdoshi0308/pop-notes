'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  MessageSquareText,
  Users,
  Settings,
  ClipboardList,
  CreditCard,
  History,
} from 'lucide-react';

const ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutGrid },
  { href: '/dashboard/form', label: 'Form Builder', icon: ClipboardList },
  { href: '/dashboard/sms', label: 'SMS Editor', icon: MessageSquareText },
  { href: '/dashboard/history', label: 'History', icon: History },
  { href: '/dashboard/team', label: 'Team', icon: Users },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function NavLinks({ role }: { role: string }) {
  const path = usePathname();

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {ITEMS.map((item) => {
        const active = path === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition',
              active
                ? 'bg-rose-50 text-brand-primary'
                : 'text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
      {role !== 'admin' && (
        <p className="px-3 pt-3 text-xs text-slate-400">
          You&apos;re signed in as a team member. Some sections may be read-only.
        </p>
      )}
    </nav>
  );
}
