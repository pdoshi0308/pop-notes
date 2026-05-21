'use client';

import { createBrowserClient } from '@supabase/ssr';

// Browser-side Supabase client. Used by dashboard pages to maintain a session.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
