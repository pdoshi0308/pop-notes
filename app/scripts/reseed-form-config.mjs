// Update existing form configs to the new default ordering (postcode before address).
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const fields = [
  { id: 'full_name', required: true },
  { id: 'mobile_number', required: true },
  { id: 'date_of_birth', required: true },
  { id: 'email', required: true },
  { id: 'postcode', required: false },
  { id: 'address_line_1', required: false },
];

const { data: cfgs } = await admin.from('form_configs').select('workspace_id');
for (const c of cfgs ?? []) {
  await admin.from('form_configs').update({
    fields,
    updated_at: new Date().toISOString(),
  }).eq('workspace_id', c.workspace_id);
  console.log('updated', c.workspace_id);
}
console.log('done');
