'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

const IDLE_MS = 8 * 60 * 60 * 1000;
const STORAGE_KEY = 'pingform.dashboard_last_active';

export default function IdleSignOutWatcher() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let signedOut = false;

    function readLast(): number {
      try {
        const v = parseInt(localStorage.getItem(STORAGE_KEY) ?? '', 10);
        return Number.isFinite(v) ? v : Date.now();
      } catch {
        return Date.now();
      }
    }

    function writeLast(t: number) {
      try {
        localStorage.setItem(STORAGE_KEY, String(t));
      } catch {
        // ignore
      }
    }

    async function doSignOut() {
      if (signedOut) return;
      signedOut = true;
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // proceed anyway
      }
      router.push('/dashboard/login?error=idle');
      router.refresh();
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      const last = readLast();
      const remaining = Math.max(0, last + IDLE_MS - Date.now());
      if (remaining === 0) {
        void doSignOut();
        return;
      }
      timer = setTimeout(() => {
        const now = Date.now();
        if (now - readLast() >= IDLE_MS) {
          void doSignOut();
        } else {
          schedule();
        }
      }, remaining);
    }

    function bump() {
      writeLast(Date.now());
      schedule();
    }

    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'focus',
    ];

    bump();

    let bumpTimer: ReturnType<typeof setTimeout> | null = null;
    function throttledBump() {
      if (bumpTimer) return;
      bumpTimer = setTimeout(() => {
        bumpTimer = null;
        bump();
      }, 30_000);
    }

    for (const ev of events) {
      window.addEventListener(ev, throttledBump, { passive: true });
    }

    function onVisible() {
      if (document.visibilityState === 'visible') {
        if (Date.now() - readLast() >= IDLE_MS) {
          void doSignOut();
        } else {
          schedule();
        }
      }
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (timer) clearTimeout(timer);
      if (bumpTimer) clearTimeout(bumpTimer);
      for (const ev of events) {
        window.removeEventListener(ev, throttledBump);
      }
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router]);

  return null;
}
