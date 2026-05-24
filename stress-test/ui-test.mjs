// Pingform UI test — drives a real Chromium browser through the dashboard,
// captures console errors, network failures, layout regressions, and any
// issue a non-technical user would hit. Cleans up via Supabase admin at end.

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { createClient } from '../app/node_modules/@supabase/supabase-js/dist/index.mjs';

const env = Object.fromEntries(
  readFileSync(new URL('../app/.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const APP = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const TAG = 'UISTRESS';

const admin = createClient(SUPABASE_URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

mkdirSync('stress-test/screenshots', { recursive: true });

const findings = [];
function flag(severity, area, msg, extra = {}) {
  findings.push({ severity, area, msg, ...extra });
  console.log(`[${severity.toUpperCase()}] ${area}: ${msg}`, extra.detail ?? '');
}

const tStart = Date.now();
const log = (m) => console.log(`${((Date.now() - tStart) / 1000).toFixed(1)}s ${m}`);

// --- Create one test account via admin so we can sign in straight away ------
const email = `${TAG.toLowerCase()}-${Date.now()}@example.com`;
const password = 'ui-test-pw-12345';
const createdUserIds = [];
const createdWsIds = [];

log(`creating test account ${email}`);
const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
  user_metadata: { full_name: 'UI Stress', practice_name: 'UIStress Practice' },
});
if (cErr) { console.error(cErr); process.exit(1); }
createdUserIds.push(created.user.id);

await new Promise((r) => setTimeout(r, 1500));
const { data: prof } = await admin.from('users').select('workspace_id').eq('id', created.user.id).maybeSingle();
if (prof?.workspace_id) createdWsIds.push(prof.workspace_id);

// --- Launch browser ---------------------------------------------------------
log('launching Chromium');
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
const networkFails = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push({ url: page.url(), text: msg.text() });
});
page.on('response', (resp) => {
  if (resp.status() >= 500) networkFails.push({ url: resp.url(), status: resp.status() });
});

async function shot(name) {
  await page.screenshot({ path: `stress-test/screenshots/${name}.png`, fullPage: true });
}

// --- TEST 1: marketing/landing loads ---------------------------------------
log('marketing landing');
await page.goto(APP, { waitUntil: 'networkidle' });
const landingTitle = await page.title();
log(`title: ${landingTitle}`);
await shot('01-landing');

// --- TEST 2: signup page renders -------------------------------------------
log('signup page');
await page.goto(`${APP}/signup`, { waitUntil: 'networkidle' });
await shot('02-signup');
const hasEmail = await page.locator('input[type=email]').count();
if (hasEmail === 0) flag('high', 'signup', 'no email input found on /signup');

// --- TEST 3: log in with the test account ----------------------------------
log('login flow');
await page.goto(`${APP}/dashboard/login`, { waitUntil: 'networkidle' });
await shot('03-login');
await page.fill('input[type=email]', email);
await page.fill('input[type=password]', password);
// React form has no type=submit on the button — click the visible Sign in button.
const signInBtn = page.getByRole('button', { name: /^sign in$/i });
await Promise.all([
  page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20000 }).catch(() => null),
  signInBtn.click(),
]);
await page.waitForLoadState('networkidle');
log(`after login url: ${page.url()}`);
if (!page.url().includes('/dashboard')) {
  flag('critical', 'auth', `login did not redirect — landed at ${page.url()}`);
}
await shot('04-dashboard');

// --- TEST 4: dashboard home + all sidebar items ----------------------------
const navLinks = [
  ['/dashboard', '04a-home'],
  ['/dashboard/form', '05-form'],
  ['/dashboard/sms', '06-sms'],
  ['/dashboard/history', '07-history'],
  ['/dashboard/team', '08-team'],
  ['/dashboard/billing', '09-billing'],
  ['/dashboard/account', '10-account'],
  ['/dashboard/settings', '11-settings'],
];
for (const [path, name] of navLinks) {
  log(`visiting ${path}`);
  const nav = await page.goto(`${APP}${path}`, { waitUntil: 'networkidle' }).catch((e) => e);
  if (nav && nav.message) {
    flag('high', 'nav', `failed to load ${path}: ${nav.message}`);
    continue;
  }
  await shot(name);
  const bodyText = (await page.locator('body').innerText()).toLowerCase();
  // Look for actual error UI, not the literal string "500" which appears
  // legitimately in pricing ("500 SMS forms / month").
  if (
    bodyText.includes('application error') ||
    bodyText.includes('something went wrong') ||
    bodyText.includes('this page could not be found') && path !== '/dashboard/this-does-not-exist'
  ) {
    flag('critical', 'page-render', `${path} shows error UI`);
  }
  if (bodyText.length < 50) {
    flag('high', 'page-render', `${path} rendered empty page`);
  }
}

// --- TEST 5: mobile viewport — does anything overflow / break? -------------
log('mobile viewport regression');
await page.setViewportSize({ width: 375, height: 812 });
await page.goto(`${APP}/dashboard`, { waitUntil: 'networkidle' });
await shot('12-mobile-dashboard');
// detect horizontal overflow (a major sign of broken mobile layout)
const overflow = await page.evaluate(() => ({
  body: document.body.scrollWidth,
  win: window.innerWidth,
}));
if (overflow.body > overflow.win + 4) {
  flag('medium', 'mobile', `dashboard horizontal overflow on 375px: body=${overflow.body} > viewport=${overflow.win}`);
}

await page.goto(`${APP}/dashboard/team`, { waitUntil: 'networkidle' });
await shot('13-mobile-team');
await page.goto(`${APP}/dashboard/history`, { waitUntil: 'networkidle' });
await shot('14-mobile-history');

// --- TEST 6: patient registration form (public, /register) ----------------
log('patient register page');
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${APP}/register?workspace=${createdWsIds[0]}&ref=447700900000`, { waitUntil: 'networkidle' });
// Wait for the client component to fetch the workspace config and render fields.
await page.waitForSelector('input', { timeout: 10000 }).catch(() => null);
await shot('15-register');
const registerHasFields = await page.locator('input').count();
if (registerHasFields === 0) {
  flag('high', 'register', 'no inputs rendered on /register (even after 10s wait)');
}

// Fill the first step and try to advance
try {
  // Fill all visible inputs with sample data
  const inputs = await page.locator('input:visible').all();
  for (const inp of inputs) {
    const type = await inp.getAttribute('type');
    const placeholder = (await inp.getAttribute('placeholder')) ?? '';
    if (type === 'email') await inp.fill('patient@example.com');
    else if (placeholder.toUpperCase() === 'DD') await inp.fill('01');
    else if (placeholder.toUpperCase() === 'MM') await inp.fill('01');
    else if (placeholder.toUpperCase() === 'YYYY') await inp.fill('1990');
    else if (type === 'tel') await inp.fill('+447700900000');
    else await inp.fill('Sample Patient');
  }
  await shot('16-register-filled');
  const submitBtn = page.locator('button:has-text("Continue"), button:has-text("Submit")').first();
  if (await submitBtn.count()) {
    await submitBtn.click();
    await page.waitForLoadState('networkidle');
    await shot('17-register-after-continue');
    // If we hit Submit, look for either success or Pusher error
    const bodyText = (await page.locator('body').innerText()).toLowerCase();
    if (bodyText.includes('realtime is not configured')) {
      flag('medium', 'register', '/api/submit fails with "Realtime is not configured" — central Pusher env vars missing in this environment. End-to-end patient flow is broken until Pusher creds are present.');
    }
  }
} catch (e) {
  log(`register interaction error: ${e.message}`);
}

// --- TEST 7: history page at scale --------------------------------------
// Seed 250 fake submissions and re-check history page UX.
log('seeding 250 submissions for history UX check');
const seeds = Array.from({ length: 250 }, (_, i) => ({
  workspace_id: createdWsIds[0],
  phone: `+447700${String(900000 + i).padStart(6, '0')}`,
  fields: {
    full_name: `History Test ${i}`,
    email: `h${i}@example.com`,
    mobile_number: `+447700${String(900000 + i).padStart(6, '0')}`,
    date_of_birth: '01/01/1990',
  },
}));
const { error: seedErr } = await admin.from('submissions').insert(seeds);
if (seedErr) log(`seed error: ${seedErr.message}`);

// Upgrade to paid plan so the history page renders (gated to non-free).
await admin.from('workspaces').update({ plan: 'starter' }).eq('id', createdWsIds[0]);

await page.setViewportSize({ width: 1440, height: 900 });
const hStart = Date.now();
await page.goto(`${APP}/dashboard/history`, { waitUntil: 'networkidle' });
const hLoad = Date.now() - hStart;
log(`history page load: ${hLoad}ms`);
if (hLoad > 4000) flag('medium', 'history', `history page load ${hLoad}ms at 250 submissions — gets worse as DB grows`);
await shot('18-history-250');

const rendered = await page.locator('.card').count();
log(`history rendered ${rendered} cards from 250 rows`);
if (rendered >= 200) {
  flag('medium', 'history', `history caps at 200 rows with no pagination/search/date filter — users with >200 submissions can't access older ones`);
}

// Check the page has any search/filter/pagination UI
const hasSearch = (await page.getByPlaceholder(/search/i).count()) > 0;
const hasPaginate = (await page.locator('text=/next|previous|load more|page \\d/i').count()) > 0;
const hasFilter = (await page.locator('text=/filter|from|to|date/i').count()) > 0;
if (!hasSearch) flag('medium', 'history', 'no search input on history — finding a specific submission means scrolling 200 cards');
if (!hasPaginate) flag('medium', 'history', 'no pagination on history');
if (!hasFilter) flag('low', 'history', 'no date filter on history');

// --- TEST 8: team page at scale ------------------------------------------
log('checking team page admin controls visible');
await page.goto(`${APP}/dashboard/team`, { waitUntil: 'networkidle' });
await shot('19-team');
const inviteBtn = await page.locator('button:has-text("Send invite")').count();
if (inviteBtn === 0) flag('high', 'team', 'no Send invite button visible to admin');

// Mobile team view
await page.setViewportSize({ width: 375, height: 812 });
await page.goto(`${APP}/dashboard/team`, { waitUntil: 'networkidle' });
await shot('20-team-mobile');
const teamOverflow = await page.evaluate(() => ({
  body: document.body.scrollWidth,
  win: window.innerWidth,
}));
if (teamOverflow.body > teamOverflow.win + 4) {
  flag('medium', 'mobile', `team page overflow mobile: ${teamOverflow.body}px on ${teamOverflow.win}px`);
}

// --- TEST 9: form builder ------------------------------------------------
log('form builder');
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${APP}/dashboard/form`, { waitUntil: 'networkidle' });
await shot('21-form-builder');

// --- TEST 10: billing page at scale of subscriptions ---------------------
log('billing page');
await page.goto(`${APP}/dashboard/billing`, { waitUntil: 'networkidle' });
await shot('22-billing');

// --- TEST 11: 404 handling -----------------------------------------------
log('404 page');
await page.goto(`${APP}/dashboard/this-does-not-exist`, { waitUntil: 'networkidle' });
await shot('23-404');

// --- Network + console errors ---
if (consoleErrors.length) {
  // De-dupe by text
  const unique = [...new Set(consoleErrors.map((e) => e.text))].slice(0, 8);
  for (const text of unique) {
    flag('low', 'console', `browser console error: ${text.slice(0, 200)}`);
  }
}
if (networkFails.length) {
  for (const fail of networkFails.slice(0, 8)) {
    flag('high', 'network', `${fail.status} on ${fail.url}`);
  }
}

// --- REPORT --------------------------------------------------------------
console.log('\n========== UI FINDINGS ==========');
const order = ['critical', 'high', 'medium', 'low'];
for (const f of findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))) {
  console.log(`[${f.severity.toUpperCase()}] ${f.area}: ${f.msg}`);
  if (f.detail) console.log(`        ${f.detail}`);
}
console.log(`\nTotal findings: ${findings.length}`);
console.log(`Screenshots in stress-test/screenshots/`);

// --- CLEANUP -----------------------------------------------------------
log('cleanup');
await browser.close();
if (createdWsIds.length) {
  await admin.from('submissions').delete().in('workspace_id', createdWsIds);
  await admin.from('invitations').delete().in('workspace_id', createdWsIds);
  await admin.from('workspaces').delete().in('id', createdWsIds);
}
for (const id of createdUserIds) {
  await admin.auth.admin.deleteUser(id);
}
log(`done. deleted ${createdWsIds.length} ws + ${createdUserIds.length} users`);
