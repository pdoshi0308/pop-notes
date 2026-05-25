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
  UserCircle,
} from 'lucide-react';

const ADMIN_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutGrid },
  { href: '/dashboard/form', label: 'Form Builder', icon: ClipboardList },
  { href: '/dashboard/sms', label: 'SMS Editor', icon: MessageSquareText },
  { href: '/dashboard/history', label: 'History', icon: History },
  { href: '/dashboard/team', label: 'Team', icon: Users },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/account', label: 'Account', icon: UserCircle },
];

const MEMBER_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutGrid },
  { href: '/dashboard/account', label: 'Account', icon: UserCircle },
];

export default function NavLinks({
  role,
  onNavigate,
}: {
  role: string;
  onNavigate?: () => void;
}) {
  const path = usePathname();
  const items = role === 'admin' ? ADMIN_ITEMS : MEMBER_ITEMS;

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {items.map((item) => {
        const active = path === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
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
    </nav>
  );
}
