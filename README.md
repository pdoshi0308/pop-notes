# Popform

> A Chrome extension that lets medical and dental receptionists send a
> customisable registration form to a patient via SMS while they're on the
> phone, and receive the completed details back in real time inside the
> extension.

```
.
├── extension/   Chrome extension (vanilla JS, Manifest V3)
├── app/         Next.js 15 app — dashboard, patient form, API routes
├── supabase/    schema.sql for the Postgres database
└── README.md    (you are here)
```

## How it works

1. A receptionist logs into the Chrome extension and types the patient's mobile
   number while still on the call.
2. The extension hits `POST /api/send`, which uses the practice's own Twilio
   account to text the patient a link to `popform.io/register?workspace=…&ref=…`.
3. The patient fills the form on their phone. The form is configurable per
   practice and supports postcode lookup via [postcodes.io](https://postcodes.io/).
4. The form POSTs to `/api/submit`, which fires a Pusher event on a channel
   keyed to the patient's number.
5. The receptionist's extension is already subscribed to that channel — the
   completed patient card animates in instantly with copy buttons.

Twilio and Pusher credentials are **per workspace** (BYO), stored encrypted-at-rest
in Supabase. Each practice brings their own.

---

## 1. Supabase setup

1. Create a new project at <https://supabase.com>.
2. Open the **SQL Editor**, paste the contents of `supabase/schema.sql`, and
   run it. This creates `workspaces`, `users`, and `form_configs` plus the
   RLS policies.
3. In **Project Settings → API**, copy:
   - the **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - the **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - the **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server-only)

### Create your first workspace + admin user (one-time)

The dashboard doesn't have a self-serve sign-up yet — each new practice is
provisioned by hand:

1. **Authentication → Users → Add User** in Supabase. Pick `Email`, set a
   password, untick "Send invite email". Note the user's UUID.
2. Open the **SQL Editor** and run, replacing the placeholders:

   ```sql
   -- 1. Create the workspace
   insert into public.workspaces (name) values ('Smile Dental')
   returning id;

   -- 2. Tie the auth user to it as an admin
   insert into public.users (id, workspace_id, role, full_name)
   values (
     '<auth user UUID>',
     '<workspace UUID from step 1>',
     'admin',
     'Practice Owner'
   );

   -- 3. (optional) seed a starter form config
   insert into public.form_configs (workspace_id, fields) values (
     '<workspace UUID>',
     '[
       {"id":"full_name","required":true},
       {"id":"mobile_number","required":true},
       {"id":"date_of_birth","required":true},
       {"id":"email","required":true},
       {"id":"postcode","required":false},
       {"id":"address_line_1","required":false}
     ]'::jsonb
   );
   ```

3. Sign in at `/dashboard/login` with the credentials you just created. From
   there, add Twilio + Pusher keys via **Settings**.

---

## 2. Twilio credentials

1. Sign up at <https://www.twilio.com>.
2. From the Console homepage, copy the **Account SID** and **Auth Token**.
3. Buy a UK mobile SMS-enabled number — note it in **E.164** format
   (`+447XXXXXXXXX`).
4. Paste all three into the **Settings** page of the dashboard.

> Twilio's trial accounts can only message verified numbers. For real-world
> testing, upgrade or pre-verify the patient handsets you're sending to.

---

## 3. Pusher credentials

1. Create a free Channels app at <https://pusher.com/channels>.
2. Pick the **eu** cluster (or whichever region you prefer).
3. From **App Keys**, copy `app_id`, `key`, `secret`, and `cluster`.
4. Paste them into **Settings** in the dashboard.

The extension only ever sees the `key` and `cluster` — the `secret` stays on
the server.

---

## 4. Deploy the Next.js app

```bash
cd app
cp .env.example .env.local   # fill in your Supabase keys + NEXT_PUBLIC_APP_URL
npm install
npm run dev                   # http://localhost:3000
```

### Vercel deploy

1. Push the repo to GitHub.
2. In Vercel, **Add New Project** and select the repo. Set the **Root
   Directory** to `app/`.
3. Add the env vars from `.env.example` in **Project Settings → Environment
   Variables**.
4. Deploy. Once the production URL is live, set `NEXT_PUBLIC_APP_URL` to it.
5. Point your custom domain (e.g. `popform.io`) at the Vercel project.

The API routes (`/api/send`, `/api/submit`, `/api/workspace-config`, `/api/me`)
run on Vercel Functions (Node.js) — no extra config required.

---

## 5. Load the Chrome extension

The extension is a static MV3 bundle — no build step.

1. **Download the Pusher client bundle** (the manifest CSP forbids loading
   scripts from a CDN, so it must ship locally):

   ```powershell
   Invoke-WebRequest `
     -Uri https://js.pusher.com/8.4/pusher.min.js `
     -OutFile extension\lib\pusher.min.js
   ```

   …or on macOS/Linux:

   ```bash
   curl -L https://js.pusher.com/8.4/pusher.min.js -o extension/lib/pusher.min.js
   ```

2. Drop three PNG icons into `extension/icons/` (16, 48 and 128 px). Any square
   PNG in the brand gradient works as a placeholder.

3. Edit `extension/config.js` and fill in:
   - `SUPABASE_URL` — same as the dashboard's `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_ANON_KEY` — same as the dashboard's `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `API_BASE` — your deployed Next.js URL (e.g. `https://popform.io`)

4. Open `chrome://extensions`, flip on **Developer mode** (top-right), click
   **Load unpacked**, and pick the `extension/` folder.

5. Pin the Popform icon to the toolbar. Click it, sign in with the admin
   credentials you created in step 1, and you're ready to send forms.

> Note: each release of the extension needs the same `config.js` edits.
> For production you'd typically build per-environment.

---

## 6. End-to-end test checklist

Run through this on a fresh deployment:

- [ ] `supabase/schema.sql` applied; `workspaces` / `users` / `form_configs`
      visible in the Table Editor.
- [ ] A workspace + admin user exist in Supabase.
- [ ] Admin can sign in at `/dashboard/login` and the sidebar shows the
      practice name.
- [ ] **Form Builder** loads with starter fields; reorder + toggle required
      saves successfully (a brief "Saved" appears).
- [ ] **SMS Editor** shows the template, variable chips insert tokens, save
      works.
- [ ] **Settings** stores Twilio + Pusher creds; saving a second time leaves
      them populated (no clearing).
- [ ] Extension loads (no red errors in `chrome://extensions`).
- [ ] Extension login with the same admin email/password works; the practice
      name appears at the top.
- [ ] Type a UK mobile (`07700 900 123`) — input auto-formats, **Send Form**
      enables only when the number is valid.
- [ ] Click **Send Form**. The patient's phone receives the SMS within a few
      seconds. The extension enters the waiting state.
- [ ] On the patient's phone, open the link. The form renders with the
      practice name, the mobile field pre-filled, and (if many fields) a
      progress bar.
- [ ] Postcode field triggers an auto-fill once a valid postcode is entered.
- [ ] Submit the form. The patient sees the green confirmation screen.
- [ ] In the extension, the patient card animates in with all fields visible.
- [ ] Per-field copy and **Copy all** buttons place the right text on the
      clipboard.
- [ ] **Send another** resets the screen.
- [ ] Sign out clears the session — re-opening the extension shows the login
      screen.

---

## Tech stack

| Piece            | Tool                                      |
|------------------|-------------------------------------------|
| Chrome extension | Vanilla JS, HTML, CSS, Manifest V3        |
| Dashboard + form | Next.js 15 (App Router) + TypeScript      |
| Styling          | Tailwind CSS + Inter (via Google Fonts)   |
| Auth             | Supabase Auth (email/password + magic link) |
| Database         | Supabase Postgres + Row-Level Security    |
| Realtime         | Pusher Channels (per-workspace creds)     |
| SMS              | Twilio (per-workspace creds)              |
| Hosting          | Vercel                                    |
| Postcode lookup  | postcodes.io (free, no key)               |

---

## File map

```
extension/
  manifest.json
  config.js              # API + Supabase keys (edit before loading)
  popup.html             # Login + main UI
  popup.css              # All extension styles
  popup.js               # Controller — auth, send, Pusher
  lib/
    api.js               # Supabase auth + Popform API calls
    phone.js             # UK formatter / E.164 normaliser
    pusher.min.js        # Drop the real bundle here (see step 5)
  icons/
    icon16.png           # add your own
    icon48.png
    icon128.png

app/
  package.json
  next.config.js
  tailwind.config.ts
  postcss.config.mjs
  tsconfig.json
  .env.example
  app/
    layout.tsx
    page.tsx             # Marketing landing
    globals.css
    register/
      page.tsx
      register-client.tsx
    dashboard/
      layout.tsx
      page.tsx           # Overview
      login/page.tsx
      form/
        page.tsx
        form-builder.tsx
      sms/
        page.tsx
        sms-editor.tsx
      team/
        page.tsx
        team-panel.tsx
      settings/
        page.tsx
        settings-form.tsx
      components/
        nav-links.tsx
        sign-out-button.tsx
    api/
      send/route.ts
      submit/route.ts
      workspace-config/route.ts
      me/route.ts
  lib/
    fields.ts
    phone.ts
    supabase-browser.ts
    supabase-server.ts

supabase/
  schema.sql
```

---

## Known follow-ups

A few items are intentionally simple and worth tightening before scaling:

- **Self-serve sign-up** — practices are created by hand today. A `/signup`
  flow that provisions a workspace + Stripe subscription is a natural next step.
- **Encryption at rest for Twilio/Pusher creds** — currently stored as plain
  text in Supabase, relying on RLS. Consider pgsodium or Vault for column
  encryption.
- **Magic-link invites** — the dashboard sends a Supabase OTP today. The user
  row still has to be inserted into `public.users` by an admin once the invitee
  accepts.
- **Audit log / submission history** — submissions fire-and-forget through
  Pusher and aren't persisted. Add a `submissions` table if practices want a
  paper trail.
- **Per-environment extension config** — `config.js` is hand-edited. For
  production, wire this into a build step.
