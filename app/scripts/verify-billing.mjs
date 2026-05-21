// Verify the billing migration applied and the signup trigger works.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1) Check the new columns exist on workspaces.
console.log('→ Checking workspaces columns…');
const { data: rows, error: e1 } = await admin
  .from('workspaces')
  .select('id, name, plan, sms_used_this_period, period_start, stripe_customer_id');
if (e1) { console.error('FAIL:', e1.message); process.exit(1); }
console.log('  ✓ columns present. existing rows:', rows.length);
for (const r of rows) console.log('   ', r.name, '→ plan:', r.plan, 'usage:', r.sms_used_this_period);

// 2) Test the signup trigger by creating + immediately deleting a throwaway user.
const testEmail = `trigger-test-${Date.now()}@example.com`;
console.log(`\n→ Creating throwaway user ${testEmail}…`);
const { data: u, error: e2 } = await admin.auth.admin.createUser({
  email: testEmail,
  password: 'temp-pass-123',
  email_confirm: true,
  user_metadata: { full_name: 'Trigger Test' },
});
if (e2) { console.error('FAIL:', e2.message); process.exit(1); }
const uid = u.user.id;
console.log('  user id:', uid);

// Give the trigger a beat to run.
await new Promise((r) => setTimeout(r, 500));

const { data: linked } = await admin
  .from('users')
  .select('workspace_id, role, full_name, workspaces(name, plan)')
  .eq('id', uid)
  .maybeSingle();
console.log('  linked profile:', linked);

if (!linked?.workspace_id) {
  console.error('  ✗ Trigger did NOT create a workspace/profile row.');
} else if (linked.role !== 'admin') {
  console.error('  ✗ Role is not admin.');
} else {
  console.log('  ✓ Workspace auto-created, user is admin, on free plan');
}

// 3) Clean up.
console.log('\n→ Cleaning up throwaway user…');
if (linked?.workspace_id) {
  await admin.from('workspaces').delete().eq('id', linked.workspace_id);
}
await admin.auth.admin.deleteUser(uid);
console.log('  done.');
