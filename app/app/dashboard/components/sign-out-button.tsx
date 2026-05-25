'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function SignOutButton({ withLabel = false }: { withLabel?: boolean }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut({ scope: 'local' });
    router.push('/dashboard/login');
    router.refresh();
  }

  if (withLabel) {
    return (
      <button
        type="button"
        onClick={signOut}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 w-full"
      >
        <LogOut className="w-4 h-4" /> Sign out
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={signOut}
      title="Sign out"
      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
    >
      <LogOut className="w-4 h-4" />
    </button>
  );
}
