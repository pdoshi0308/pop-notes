# Popform

> SMS-driven patient registration for UK medical and dental practices.

```
.
├── extension/   Chrome extension (vanilla JS, MV3, side panel)
├── app/         Next.js 15 app — landing, signup, dashboard, patient form, API
├── supabase/    Schema + migrations (auto-applied via the GitHub integration)
└── README.md
```

## Renaming the product

The product name is centralised. To rebrand:

1. Edit `app/lib/brand.ts` — change `name`, `tagline`, `description`, `domain`, `supportEmail`.
2. Edit `extension/config.js` — change `BRAND_NAME`.
3. Optionally replace `extension/icons/icon{16,48,128}.png`.

Everything else reads from those two files (landing page, dashboard, extension chrome, emails, OG metadata).

---

## How it works

1. **Receptionist** opens the Popform side panel in Chrome, types the patient's mobile, clicks **Send Form**.
2. **`/api/send`** validates the user's plan + SMS quota, then sends an SMS via Twilio with a link to `popform.io/register?workspace=…&ref=…`.
3. **Patient** fills the mobile-optimised form (postcode lookup, native autofill).
4. **`/api/submit`** fires a Pusher event on a channel keyed to the patient's number.
5. The extension is already subscribed → patient card animates in with copy buttons.
6. The send counter on `workspaces.sms_used_this_period` increments. Resets on the 1st of each month.

---

## 1. Supabase setup

1. Create a project at <https://supabase.com>.
2. Apply migrations — either:
   - **GitHub integration** (recommended): connect the Supabase project to this repo; new migrations land automatically.
   - **Manual**: paste each file under `supabase/migrations/` into the SQL Editor in timestamp order.
3. **Settings → API**: copy the URL, the publishable (anon) key, and the service-role key.
4. **Authentication → Providers → Google**: enable + paste your Google OAuth client ID & secret (5-minute setup in Google Cloud Console — Supabase walks you through it).

> First-user onboarding is automatic thanks to the `on_auth_user_created` trigger — signing up via the `/signup` page or Google OAuth creates a workspace + admin user + default form config without manual SQL.

## 2. Stripe setup

1. Sign up at <https://stripe.com>, switch to **test mode** for development.
2. **Products** → create three recurring monthly products: Starter (£29), Pro (£79), Practice (£149). Copy each price ID.
3. **Developers → API keys**: copy the secret key + publishable key.
4. **Developers → Webhooks** → Add endpoint:
   - URL: `https://your-domain.com/api/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the signing secret.

When ready for production, repeat in live mode.

## 3. Twilio setup

Popform uses a **central Twilio account** that pays for every customer's SMS. Each workspace's monthly allowance is enforced by `/api/send`.

1. Sign up at <https://twilio.com>.
2. Buy a UK mobile SMS-enabled number in E.164 format (`+447…`).
3. From the Console copy the **Account SID** + **Auth Token**.

## 4. Local development

```powershell
cd app
Copy-Item .env.example .env.local
# Fill in all the env vars from steps 1–3 above.
npm install
npm run dev
```

Open <http://localhost:3000>. Sign up at <http://localhost:3000/signup>.

For the extension:

```powershell
cd extension
Invoke-WebRequest https://js.pusher.com/8.4/pusher.min.js -OutFile lib\pusher.min.js
```

Edit `extension/config.js` with your Supabase URL + anon key + `API_BASE=http://localhost:3000`.

`chrome://extensions` → Developer mode → Load unpacked → `extension\` folder.

## 5. Deploying to Vercel via Git

1. Push the repo to GitHub.
2. Vercel → **Add New Project** → select the repo.
3. **Root Directory** → `app`.
4. **Environment Variables** → paste every key from `.env.example` (mark the secret ones as Sensitive).
5. Deploy.
6. After the first deploy:
   - Set `NEXT_PUBLIC_APP_URL` to the production URL.
   - Update the Stripe webhook endpoint URL to the production one + paste the new signing secret.

`vercel.json` already pins the deploy to the `lhr1` region (London) and sets function timeouts.

## 6. End-to-end checklist

- [ ] Visit the landing page (`/`) — pricing tiers render with your plan IDs.
- [ ] `/signup` creates a workspace + admin row automatically.
- [ ] Dashboard sidebar shows Overview / Form / SMS / Team / Billing / Settings.
- [ ] Extension side panel opens; the billing strip shows the plan + usage bar.
- [ ] Sending a form decrements the available quota.
- [ ] At quota: `/api/send` returns HTTP 402 with a friendly upgrade message.
- [ ] `/dashboard/billing` → Upgrade button hands off to Stripe Checkout.
- [ ] After successful payment, the webhook flips `workspaces.plan`; usage bar shows the new limit.
- [ ] Customer Portal opens for active subscribers (manage / cancel).

---

## Tech stack

| Layer | Tool |
|---|---|
| Chrome extension | Vanilla JS, MV3, Chrome Side Panel API |
| Web app | Next.js 15 (App Router) + TypeScript + Tailwind |
| Auth | Supabase Auth (email + Google OAuth) |
| Database | Supabase Postgres + RLS |
| Real-time | Pusher Channels |
| SMS | Twilio (central account) |
| Billing | Stripe Checkout + Customer Portal |
| Hosting | Vercel (UK / lhr1) |
| Postcode lookup | postcodes.io (free, no key) |

---

## File map

```
extension/
  manifest.json         MV3, side_panel
  background.js         Service worker (opens side panel on icon click)
  config.js             BRAND_NAME + Supabase / API base
  popup.html / .css / .js
  lib/
    api.js  phone.js  pusher.min.js

app/
  lib/
    brand.ts            Product name + domain (single source of truth)
    plans.ts            Pricing tiers + SMS limits
    fields.ts           Patient form field catalogue
    phone.ts            UK mobile helpers
    stripe.ts           Lazy Stripe client
    supabase-browser.ts supabase-server.ts
  components/
    marketing-nav.tsx   pricing-table.tsx
  app/
    layout.tsx page.tsx globals.css
    signup/              Self-serve signup (email + Google)
    register/            Mobile patient form (postcode lookup, autofill)
    dashboard/
      page.tsx  layout.tsx
      login/   form/   sms/   team/   billing/   settings/
    api/
      send/                Validates + sends SMS, enforces quota
      submit/              Fires Pusher event
      workspace-config/    Returns field config for patient form
      me/                  Returns user + billing for extension
      workspace/           GET/PATCH workspace settings (admin)
      checkout/            Stripe Checkout session
      customer-portal/     Stripe Customer Portal
      stripe-webhook/      Subscription state → workspaces.plan

supabase/
  schema.sql                                            Legacy reference
  migrations/
    20260521000000_initial_schema.sql
    20260521010000_fix_rls_recursion.sql
    20260521020000_billing_and_signup.sql               Plans, usage, signup trigger
```
