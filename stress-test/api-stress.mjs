// Pingform API stress test — exercises critical endpoints at scale,
// captures bottlenecks/bugs, then deletes everything it created.
//
// Run:  node stress-test/api-stress.mjs
// Requires: dev server on :3000, .env.local with SUPABASE_SERVICE_ROLE_KEY.

import { readFileSync } from 'node:fs';
import { createClient } from '../app/node_modules/@supabase/supabase-js/dist/index.mjs';

// --- bootstrap env -----------------------------------------------------------
const env = Object.fromEntries(
  readFileSync(new URL('../app/.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const TAG = 'STRESSTEST'; // marker we use to find/clean our data

if (!SUPABASE_URL || !SERVICE) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const findings = [];
function flag(severity, area, msg, extra = {}) {
  findings.push({ severity, area, msg, ...extra });
  console.log(`[${severity.toUpperCase()}] ${area}: ${msg}`, extra.detail ?? '');
}

const t0 = Date.now();
const trace = (label) => `${((Date.now() - t0) / 1000).toFixed(1)}s ${label}`;

// --- helpers -----------------------------------------------------------------
async function signUp(email, password, fullName, practiceName) {
  // Admin-create the user so we skip email confirmation. Mirrors the
  // production signup trigger via raw_user_meta_data.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, practice_name: practiceName },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user;
}

async function signIn(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`signIn ${email}: ${JSON.stringify(j)}`);
  return j.access_token;
}

async function api(path, opts = {}) {
  const r = await fetch(`${APP}${path}`, {
    method: opts.method || 'GET',
    headers: {
      'content-type': 'application/json',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: r.status, body };
}

// --- 1. Create N workspaces in parallel --------------------------------------
const N_USERS = 30;
console.log(trace(`creating ${N_USERS} test workspaces...`));

const accounts = [];
const password = 'stress-test-pw-1234';

const created = await Promise.allSettled(
  Array.from({ length: N_USERS }, (_, i) => {
    const email = `${TAG.toLowerCase()}+${i}-${Date.now()}@example.com`;
    return signUp(email, password, `Stress User ${i}`, `${TAG} Practice ${i}`).then((u) => ({
      i,
      email,
      authId: u.id,
    }));
  })
);
for (const r of created) {
  if (r.status === 'fulfilled') accounts.push(r.value);
  else flag('high', 'signup', `account create failed: ${r.reason?.message}`);
}
console.log(trace(`${accounts.length} accounts created`));

// Wait briefly for the handle_new_auth_user trigger to write public.users + workspaces.
await new Promise((r) => setTimeout(r, 1500));

// Resolve each account's workspace_id from public.users (created by the trigger).
for (const a of accounts) {
  const { data, error } = await admin
    .from('users')
    .select('workspace_id')
    .eq('id', a.authId)
    .maybeSingle();
  if (error || !data?.workspace_id) {
    flag('high', 'signup', `no workspace_id for ${a.email}`, { detail: error?.message });
  } else {
    a.workspaceId = data.workspace_id;
  }
}

const usable = accounts.filter((a) => a.workspaceId);
console.log(trace(`${usable.length} accounts have workspaces`));

// --- 2. Sign every account in to verify auth works at scale ------------------
console.log(trace('signing in all accounts...'));
const signIns = await Promise.allSettled(usable.map((a) => signIn(a.email, password)));
let signedIn = 0;
signIns.forEach((r, i) => {
  if (r.status === 'fulfilled') {
    usable[i].token = r.value;
    signedIn++;
  } else {
    flag('medium', 'auth', `signIn failed for ${usable[i].email}: ${r.reason?.message}`);
  }
});
console.log(trace(`${signedIn} accounts signed in`));

// --- 3. Hammer /api/submit (public, unauthenticated) -------------------------
//
// This is the patient-facing endpoint. It accepts ANY body. Tests:
//   - throughput
//   - whether oversized payloads are rejected
//   - whether invalid workspace_ids fail gracefully
//   - whether each request actually persists a submission row
console.log(trace('hammering /api/submit...'));
const SUBMITS_PER_WORKSPACE = 25;
const TARGETS = usable.slice(0, 10); // 10 workspaces × 25 = 250 concurrent submits

const subStart = Date.now();
const submits = await Promise.allSettled(
  TARGETS.flatMap((a) =>
    Array.from({ length: SUBMITS_PER_WORKSPACE }, (_, j) =>
      api('/api/submit', {
        method: 'POST',
        body: {
          workspace_id: a.workspaceId,
          phone: `+447700900${String(j).padStart(3, '0')}`,
          fields: {
            full_name: `${TAG} Patient ${a.i}-${j}`,
            email: `p${a.i}-${j}@example.com`,
            mobile_number: `+447700900${String(j).padStart(3, '0')}`,
            date_of_birth: '01/01/1990',
            postcode: 'SW1A 1AA',
          },
        },
      })
    )
  )
);
const subElapsed = (Date.now() - subStart) / 1000;
const okCount = submits.filter((r) => r.status === 'fulfilled' && r.value.status === 200).length;
const failCount = submits.length - okCount;
console.log(
  trace(
    `submits: ${okCount}/${submits.length} ok in ${subElapsed.toFixed(1)}s (${(
      submits.length / subElapsed
    ).toFixed(0)} req/s)`
  )
);
if (failCount > 0) {
  const sample = submits.find((r) => r.status === 'fulfilled' && r.value.status !== 200);
  flag('high', 'submit', `${failCount} submits failed under load`, {
    detail: sample?.value?.body,
  });
}

// 3b. Abuse: oversized payload
const big = 'x'.repeat(5_000_000); // 5 MB string in a JSON field
const oversizeRes = await api('/api/submit', {
  method: 'POST',
  body: {
    workspace_id: TARGETS[0].workspaceId,
    phone: '+447700900000',
    fields: { full_name: 'abuser', notes: big },
  },
});
if (oversizeRes.status === 200) {
  flag(
    'high',
    'submit',
    'accepts 5 MB payload — no size limit on /api/submit (storage + bandwidth abuse vector)'
  );
} else {
  console.log(trace(`oversized payload rejected: ${oversizeRes.status}`));
}

// 3c. Rate-limit probe: 200 hits in <2s from a single source
const rateStart = Date.now();
const rateRes = await Promise.all(
  Array.from({ length: 200 }, () =>
    api('/api/submit', {
      method: 'POST',
      body: {
        workspace_id: TARGETS[0].workspaceId,
        phone: '+447700900001',
        fields: { full_name: 'rate-probe' },
      },
    })
  )
);
const rateOk = rateRes.filter((r) => r.status === 200).length;
const rateRej = rateRes.filter((r) => r.status === 429).length;
console.log(
  trace(
    `rate probe: 200 reqs in ${((Date.now() - rateStart) / 1000).toFixed(1)}s — ${rateOk} ok, ${rateRej} 429s`
  )
);
if (rateRej === 0) {
  flag(
    'high',
    'submit',
    'no rate limit on /api/submit — 200 reqs/s/IP went through. Pusher + DB bills at risk.'
  );
}

// --- 4. /api/send race condition test ----------------------------------------
//
// Fire 5 sends concurrently from one workspace. The smsUsed counter is
// read-modify-write — concurrent sends should leave 5 in the column, but
// can leave fewer (race) which means plan limits can be bypassed.
console.log(trace('testing /api/send race condition...'));
const sender = usable[0];
const beforeSend = await admin
  .from('workspaces')
  .select('sms_used_this_period')
  .eq('id', sender.workspaceId)
  .maybeSingle();
const before = beforeSend.data?.sms_used_this_period ?? 0;

const sends = await Promise.allSettled(
  Array.from({ length: 5 }, () =>
    api('/api/send', {
      method: 'POST',
      token: sender.token,
      body: { phone: '+447700900000' },
    })
  )
);
const sentOk = sends.filter((r) => r.status === 'fulfilled' && r.value.status === 200).length;
const afterSend = await admin
  .from('workspaces')
  .select('sms_used_this_period')
  .eq('id', sender.workspaceId)
  .maybeSingle();
const after = afterSend.data?.sms_used_this_period ?? 0;
const delta = after - before;
console.log(trace(`/api/send: ${sentOk} accepted, counter went ${before} -> ${after} (delta ${delta})`));
if (sentOk > 0 && delta < sentOk) {
  flag(
    'high',
    'send',
    `SMS counter race: ${sentOk} accepted sends only counted ${delta} times. Plan limit can be bypassed.`,
    { detail: `before=${before} after=${after}` }
  );
}

// --- 5. /api/team/invite at scale: prove the listUsers O(N) scan ------------
console.log(trace('testing /api/team/invite timing...'));
const inviter = usable[1];
const inviteTimes = [];
for (let i = 0; i < 3; i++) {
  const tStart = Date.now();
  const res = await api('/api/team/invite', {
    method: 'POST',
    token: inviter.token,
    body: { email: `${TAG.toLowerCase()}-invitee-${i}-${Date.now()}@example.com`, role: 'member' },
  });
  inviteTimes.push(Date.now() - tStart);
  if (res.status !== 200) {
    flag('medium', 'invite', `invite #${i} failed`, { detail: res.body });
  }
}
const avgInvite = inviteTimes.reduce((a, b) => a + b, 0) / inviteTimes.length;
console.log(trace(`avg invite latency: ${avgInvite.toFixed(0)}ms`));
if (avgInvite > 1500) {
  flag(
    'medium',
    'invite',
    `invite endpoint averaged ${avgInvite.toFixed(0)}ms — listUsers paginate-and-scan will get worse as auth.users grows.`
  );
}

// --- 6. History page query at scale -----------------------------------------
console.log(trace('checking history query timing...'));
const hStart = Date.now();
const { count, error: cErr } = await admin
  .from('submissions')
  .select('id', { count: 'exact', head: true })
  .eq('workspace_id', TARGETS[0].workspaceId);
const hElapsed = Date.now() - hStart;
console.log(trace(`submissions for one workspace: ${count} rows, count took ${hElapsed}ms (err=${cErr?.message ?? 'none'})`));
if (hElapsed > 800) {
  flag(
    'medium',
    'history',
    `'exact' count on submissions took ${hElapsed}ms — at 100K+ rows global this will be the slowest query in /dashboard.`
  );
}

// Verify the global dashboard count uses RLS correctly (i.e. doesn't bleed).
console.log(trace('verifying submission RLS scoping...'));
{
  const a = usable[2];
  const url = `${SUPABASE_URL}/rest/v1/submissions?select=id&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: ANON, authorization: `Bearer ${a.token}` },
  });
  const rows = await res.json();
  // Check that none of the rows leak from a different workspace.
  if (Array.isArray(rows) && rows.length > 0) {
    // Cross-check: are these rows actually from a's workspace?
    const { data: theirRows } = await admin
      .from('submissions')
      .select('id')
      .eq('workspace_id', a.workspaceId);
    const theirSet = new Set((theirRows ?? []).map((r) => r.id));
    const leaked = rows.filter((r) => !theirSet.has(r.id));
    if (leaked.length > 0) {
      flag('critical', 'rls', `submissions RLS leak — saw ${leaked.length} rows from other workspaces`);
    } else {
      console.log(trace('submissions RLS scoping ok'));
    }
  } else {
    console.log(trace('submissions RLS scoping ok (empty result)'));
  }
}

// --- 7. Report ---------------------------------------------------------------
console.log('\n========== FINDINGS ==========');
for (const f of findings.sort((a, b) =>
  ['critical', 'high', 'medium', 'low'].indexOf(a.severity) -
  ['critical', 'high', 'medium', 'low'].indexOf(b.severity)
)) {
  console.log(`[${f.severity.toUpperCase()}] ${f.area}: ${f.msg}`);
  if (f.detail) console.log(`        detail:`, f.detail);
}
console.log(`\nTotal findings: ${findings.length}`);

// --- 8. CLEANUP --------------------------------------------------------------
console.log(trace('\ncleaning up test data...'));

// Delete invitations created by our test inviter
await admin
  .from('invitations')
  .delete()
  .ilike('email', `${TAG.toLowerCase()}%`);

// Delete submissions for our workspaces
const wsIds = usable.map((a) => a.workspaceId).filter(Boolean);
if (wsIds.length) {
  await admin.from('submissions').delete().in('workspace_id', wsIds);
}

// Delete each workspace (cascades to users, form_configs, submissions, invitations)
let wsDeleted = 0;
for (const ws of wsIds) {
  const { error } = await admin.from('workspaces').delete().eq('id', ws);
  if (error) console.error('ws delete', ws, error.message);
  else wsDeleted++;
}
console.log(trace(`deleted ${wsDeleted} workspaces`));

// Delete each auth user (the cascade only handled public.users, not auth.users)
let userDeleted = 0;
for (const a of accounts) {
  const { error } = await admin.auth.admin.deleteUser(a.authId);
  if (error) console.error('auth delete', a.email, error.message);
  else userDeleted++;
}
// Also clean any stub auth users created by invites
const { data: stubUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
for (const u of stubUsers?.users ?? []) {
  if (u.email && u.email.toLowerCase().startsWith(`${TAG.toLowerCase()}-invitee`)) {
    await admin.auth.admin.deleteUser(u.id);
    userDeleted++;
  }
}
console.log(trace(`deleted ${userDeleted} auth users`));

console.log(trace('done'));
