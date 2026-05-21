'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/dashboard/login');
    router.refresh();
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
