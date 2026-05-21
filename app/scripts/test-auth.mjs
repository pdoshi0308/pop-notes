// Simulate exactly what the dashboard layout does:
// 1. Sign in as the admin
// 2. Use that session's JWT to query public.users for that user's row
// If RLS/auth aren't aligned, this returns nothing even though the row exists.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

console.log('URL:', env.NEXT_PUBLIC_SUPABASE_URL);
console.log('anon key prefix:', env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20));

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('\n→ signing in…');
const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
  email: 'admin@admin.com',
  password: 'admin123',
});
if (signInErr) {
  console.error('signIn error:', signInErr);
  process.exit(1);
}
console.log('  user id:', signIn.user.id);
console.log('  jwt prefix:', signIn.session.access_token.slice(0, 30));

console.log('\n→ select * from users where id = me…');
const { data: profile, error: profileErr, status } = await supabase
  .from('users')
  .select('full_name, workspace_id, role')
  .eq('id', signIn.user.id)
  .maybeSingle();
console.log('  status:', status);
console.log('  profile:', profile);
console.log('  error:', profileErr);

console.log('\n→ select * from users (any)…');
const { data: anyUsers, error: anyErr } = await supabase
  .from('users')
  .select('id, role, workspace_id');
console.log('  users visible to this session:', anyUsers);
console.log('  error:', anyErr);
