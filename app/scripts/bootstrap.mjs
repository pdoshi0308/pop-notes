// One-off: create an admin user + workspace + link them.
// Run from the app/ folder with:  node scripts/bootstrap.mjs
//
// Uses the service-role key from .env.local, so it bypasses RLS.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Cheap .env.local parser — avoids pulling in dotenv.
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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@admin.com';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';
const PRACTICE = process.env.PRACTICE_NAME ?? 'Test Practice';

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`→ Creating auth user ${EMAIL}…`);
const { data: u, error: uErr } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
});
if (uErr && !/already.*registered|exists/i.test(uErr.message)) {
  console.error('createUser failed:', uErr);
  process.exit(1);
}

let userId = u?.user?.id;
if (!userId) {
  // Already existed — look it up.
  const { data: list } = await admin.auth.admin.listUsers();
  userId = list.users.find((x) => x.email === EMAIL)?.id;
}
console.log(`  user id: ${userId}`);

console.log(`→ Creating workspace "${PRACTICE}"…`);
// If this user is already linked to a workspace, reuse it.
const { data: existingLink } = await admin
  .from('users')
  .select('workspace_id')
  .eq('id', userId)
  .maybeSingle();

let workspaceId = existingLink?.workspace_id;
if (!workspaceId) {
  const { data: ws, error: wsErr } = await admin
    .from('workspaces')
    .insert({ name: PRACTICE })
    .select('id')
    .single();
  if (wsErr) {
    console.error('workspaces insert failed:', wsErr);
    process.exit(1);
  }
  workspaceId = ws.id;
}
console.log(`  workspace id: ${workspaceId}`);

console.log(`→ Linking user as admin…`);
const { error: linkErr } = await admin.from('users').upsert({
  id: userId,
  workspace_id: workspaceId,
  role: 'admin',
  full_name: 'Admin',
});
if (linkErr) {
  console.error('users upsert failed:', linkErr);
  process.exit(1);
}

console.log(`→ Seeding default form config…`);
const { error: cfgErr } = await admin
  .from('form_configs')
  .upsert(
    {
      workspace_id: workspaceId,
      fields: [
        { id: 'full_name', required: true },
        { id: 'mobile_number', required: true },
        { id: 'date_of_birth', required: true },
        { id: 'email', required: true },
        { id: 'postcode', required: false },
        { id: 'address_line_1', required: false },
      ],
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id' }
  );
if (cfgErr) console.warn('form_configs upsert warning:', cfgErr.message);

console.log('\nAll done.');
console.log(`  Sign in:   ${EMAIL} / ${PASSWORD}`);
console.log(`  Workspace: ${workspaceId}`);
