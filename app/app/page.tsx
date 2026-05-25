import Link from 'next/link';
import {
  ArrowRight,
  MessageSquareText,
  Zap,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  ClipboardList,
  Sparkles,
  SpellCheck,
  EyeOff,
  Lock,
  Check,
} from 'lucide-react';
import { MarketingNav, MarketingFooter } from '@/components/marketing-nav';
import { PricingTable } from '@/components/pricing-table';
import { BRAND } from '@/lib/brand';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-brand-bg">
      <MarketingNav />

      {/* Hero ------------------------------------------------------------ */}
      <section className="px-5 sm:px-8 pt-16 pb-24 max-w-6xl mx-auto text-center">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-brand-primary text-sm font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
          Free up to 10 SMS forms / month — no card
        </span>
        <h1 className="mt-6 text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
          Skip the awkward{' '}
          <span className="text-brand-primary">front-desk form</span>.<br className="hidden sm:block" />
          Text it. Done in under a minute.
        </h1>
        <p className="mt-5 text-lg text-slate-600 max-w-2xl mx-auto">
          Your team texts a registration form straight to the client&apos;s
          phone. They fill it in privately — no shouting personal details
          across a waiting room — and the completed card lands in Chrome the
          moment they hit submit.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link href="/signup" className="btn-primary !py-3 !px-5 text-base">
            Start free — 10 SMS/mo <ArrowRight className="w-4 h-4" />
          </Link>
          {BRAND.chromeStoreUrl ? (
            <a
              href={BRAND.chromeStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary !py-3 !px-5 text-base"
            >
              Add to Chrome
            </a>
          ) : (
            <a href="#how-it-works" className="btn-secondary !py-3 !px-5 text-base">
              See how it works
            </a>
          )}
        </div>
        <p className="mt-4 text-xs text-slate-400">
          No credit card. Set up in under 60 seconds.
        </p>
      </section>

      {/* Features -------------------------------------------------------- */}
      <section id="features" className="px-5 sm:px-8 max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="Features"
          title="Built for a busy front desk"
          sub="Every detail tuned for the moment a client walks in or rings up."
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
          <Feature
            icon={<EyeOff className="w-5 h-5" />}
            title="Private by default"
            body="Clients type sensitive details — phone, address, DOB, medical info — on their own phone, not out loud at a busy desk."
          />
          <Feature
            icon={<MessageSquareText className="w-5 h-5" />}
            title="Sent in one tap"
            body="Your team types the client's mobile, hits Send. They get a familiar text — no app, no login, no friction."
          />
          <Feature
            icon={<Zap className="w-5 h-5" />}
            title="Real-time arrival"
            body="A complete client card animates into the Chrome side panel the second they hit submit."
          />
          <Feature
            icon={<Smartphone className="w-5 h-5" />}
            title="Mobile-first form"
            body="Multi-step, postcode lookup, native autofill — designed for thumbs, not desktops."
          />
          <Feature
            icon={<SpellCheck className="w-5 h-5" />}
            title="Spelt right, every time"
            body="Clients type their own name, email and address. No misheard spellings, no wrong digits, no chasing."
          />
          <Feature
            icon={<ShieldCheck className="w-5 h-5" />}
            title="UK-built &amp; GDPR-ready"
            body="Data lives in EU-hosted Postgres. Per-business isolation by default. You stay in control."
          />
        </div>
      </section>

      {/* How it works ---------------------------------------------------- */}
      <section id="how-it-works" className="px-5 sm:px-8 max-w-6xl mx-auto mt-24">
        <SectionHeader
          eyebrow="How it works"
          title="Three taps to a completed registration"
          sub="From phone call to filed client details in under a minute."
        />
        <ol className="grid md:grid-cols-3 gap-4 mt-10">
          {[
            {
              n: 1,
              t: 'Your team types the number',
              b: 'In the Chrome side panel, type the client’s mobile and hit Send.',
              illustration: <StepOneArt />,
            },
            {
              n: 2,
              t: 'Client gets a text',
              b: 'They tap the link and fill in a mobile-optimised form — privately, on their own phone.',
              illustration: <StepTwoArt />,
            },
            {
              n: 3,
              t: 'Details land in Chrome',
              b: 'A client card pops in with copy buttons — paste straight into your CRM, booking system, or notes.',
              illustration: <StepThreeArt />,
            },
          ].map((step) => (
            <li key={step.n} className="card p-5">
              {step.illustration}
              <div className="mt-4 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-rose-50 text-brand-primary flex items-center justify-center font-bold text-sm shrink-0">
                  {step.n}
                </div>
                <h3 className="font-semibold text-lg">{step.t}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">{step.b}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Privacy / discretion -------------------------------------------- */}
      <section className="px-5 sm:px-8 max-w-6xl mx-auto mt-24">
        <div className="rounded-3xl bg-slate-900 text-white p-8 sm:p-12 overflow-hidden relative">
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center relative z-10">
            <div>
              <p className="text-xs uppercase tracking-wider text-rose-300 font-semibold flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" /> Discreet by design
              </p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">
                No one wants to spell their address across a waiting room.
              </h2>
              <p className="mt-4 text-slate-300 leading-relaxed">
                The traditional front desk makes clients share personal details
                out loud — phone number, date of birth, medical history, payment
                info — while a queue listens in. With {BRAND.name}, the sensitive
                bits stay on the client&apos;s own phone. Your team gets the data;
                your clients keep their dignity.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-slate-200">
                <DarkBullet>No more shouting personal info over a queue or a phone line.</DarkBullet>
                <DarkBullet>Clients answer medical and consent questions privately.</DarkBullet>
                <DarkBullet>Works whether the client is at home, in the waiting room, or out and about.</DarkBullet>
              </ul>
            </div>
            <div className="relative">
              <PrivacyArt />
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/10 to-transparent pointer-events-none" />
        </div>
      </section>

      {/* The questions reception skips ----------------------------------- */}
      <section className="px-5 sm:px-8 max-w-6xl mx-auto mt-24">
        <div className="rounded-3xl border border-rose-100 bg-rose-50/50 p-8 sm:p-12">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-brand-primary font-semibold">
                The hidden win
              </p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">
                Ask the questions your front desk won&apos;t.
              </h2>
              <p className="mt-4 text-slate-600">
                Reception is rushed. Awkward questions get skipped. Details get
                misheard or guessed. When the client fills it in themselves,
                nothing&apos;s missed, nothing&apos;s spelt wrong, and you can
                ask anything you like.
              </p>
            </div>
            <ul className="space-y-3">
              <AskItem
                icon={<TrendingUp className="w-5 h-5" />}
                q="“How did you hear about us?”"
                body="See which marketing actually brings clients in — captured on every signup instead of guessed at month-end."
              />
              <AskItem
                icon={<Sparkles className="w-5 h-5" />}
                q="Gender, consent, your own questions"
                body="Toggle on extra fields — gender, marketing consent, custom questions — in seconds from your dashboard."
              />
              <AskItem
                icon={<ClipboardList className="w-5 h-5" />}
                q="The details you always end up chasing"
                body="Full contact, address and custom fields — a complete, accurate client record without the back-and-forth."
              />
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing --------------------------------------------------------- */}
      <section id="pricing" className="px-5 sm:px-8 max-w-6xl mx-auto mt-24">
        <SectionHeader
          eyebrow="Pricing"
          title="Simple, per-business pricing"
          sub="Start free. Upgrade when you outgrow the limit. Cancel any time."
        />
        <div className="mt-10">
          <PricingTable />
        </div>
      </section>

      {/* FAQ ------------------------------------------------------------- */}
      <section id="faq" className="px-5 sm:px-8 max-w-3xl mx-auto mt-24">
        <SectionHeader
          eyebrow="FAQ"
          title="Common questions"
          sub=""
        />
        <div className="mt-8 space-y-3">
          <Faq
            q="Do you cover the SMS cost?"
            a={`Yes. ${BRAND.name} pays for every SMS we send on your behalf. Your monthly allowance is included in the plan price — no separate Twilio bill, no top-ups.`}
          />
          <Faq
            q="Will clients actually fill it in on their phone?"
            a="Almost every client already opens texts within minutes — open rates beat email by a wide margin. The form is mobile-first, takes about a minute, and works without an app or login. Most submissions come back before the client puts the phone down."
          />
          <Faq
            q="Is it secure? Where is client data stored?"
            a="Yes. Data lives in EU-hosted Postgres (Supabase). Each business is isolated at the database level. We never sell or share data, and submissions are only readable by admins of your workspace."
          />
          <Faq
            q="Does it work with my existing software?"
            a="Yes. Your team copies completed details from the Chrome extension into your CRM, booking system, or any tool that accepts typed input. Direct integrations with the most-requested platforms are on the roadmap."
          />
          <Faq
            q="Can I customise which fields the client sees?"
            a="Yes. The form builder lets you toggle fields on/off, mark them required, reorder them with drag-and-drop, and add your own custom questions — all from your dashboard."
          />
          <Faq
            q="What if my team closes Chrome before the client submits?"
            a="The extension lives as a Chrome side panel so it stays open while your team switches tabs. Completed submissions are saved on every paid plan, so nothing is lost — just open the dashboard's History tab to find it."
          />
        </div>
      </section>

      {/* CTA banner ------------------------------------------------------ */}
      <section className="px-5 sm:px-8 max-w-6xl mx-auto mt-24">
        <div className="rounded-3xl bg-gradient-to-br from-brand-primary to-brand-accent text-white p-8 sm:p-12 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Save your team 5 minutes per new client.
          </h2>
          <p className="mt-3 text-rose-100 max-w-xl mx-auto">
            Try {BRAND.name} on your next 10 clients free. No credit card, no
            setup call.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-brand-primary font-semibold hover:bg-rose-50 transition"
          >
            Start free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

function SectionHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <p className="text-xs uppercase tracking-wider text-brand-primary font-semibold">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">
        {title}
      </h2>
      {sub && <p className="mt-3 text-slate-600">{sub}</p>}
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-5">
      <div className="w-10 h-10 rounded-xl bg-rose-50 text-brand-primary flex items-center justify-center">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}

function AskItem({
  icon,
  q,
  body,
}: {
  icon: React.ReactNode;
  q: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3 bg-white border border-rose-100 rounded-2xl p-4">
      <div className="w-9 h-9 shrink-0 rounded-xl bg-rose-50 text-brand-primary flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-sm">{q}</p>
        <p className="mt-0.5 text-sm text-slate-600">{body}</p>
      </div>
    </li>
  );
}

function DarkBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="w-4 h-4 text-rose-300 mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

// --- "How it works" step illustrations -----------------------------------
// Inline SVG so they scale crisply and stay on-brand with the rose-red theme.

function StepOneArt() {
  return (
    <svg
      viewBox="0 0 280 180"
      className="w-full h-44 rounded-xl bg-rose-50/60"
      role="img"
      aria-label="Chrome side panel with phone input"
    >
      <rect x="80" y="20" width="120" height="140" rx="10" fill="white" stroke="#E2E8F0" />
      <rect x="92" y="32" width="14" height="14" rx="4" fill="#E11D48" />
      <rect x="112" y="36" width="44" height="6" rx="3" fill="#0F172A" />
      <rect x="92" y="60" width="38" height="5" rx="2.5" fill="#94A3B8" />
      <rect x="92" y="72" width="96" height="22" rx="6" fill="white" stroke="#CBD5E1" />
      <text x="100" y="87" fontSize="10" fill="#0F172A" fontFamily="ui-monospace, monospace">
        07700 900 123
      </text>
      <rect x="92" y="104" width="96" height="22" rx="6" fill="#E11D48" />
      <text x="116" y="119" fontSize="9" fill="white" fontWeight="600">
        Send by SMS
      </text>
      <rect x="92" y="132" width="96" height="20" rx="6" fill="white" stroke="#CBD5E1" />
      <text x="113" y="146" fontSize="9" fill="#0F172A" fontWeight="500">
        Send via WhatsApp
      </text>
    </svg>
  );
}

function StepTwoArt() {
  return (
    <svg
      viewBox="0 0 280 180"
      className="w-full h-44 rounded-xl bg-rose-50/60"
      role="img"
      aria-label="Client phone showing an SMS with the form link"
    >
      <rect x="100" y="12" width="80" height="156" rx="14" fill="white" stroke="#CBD5E1" strokeWidth="1.5" />
      <rect x="124" y="18" width="32" height="3" rx="1.5" fill="#CBD5E1" />
      <rect x="112" y="34" width="22" height="3" rx="1.5" fill="#94A3B8" />
      <rect x="156" y="34" width="14" height="3" rx="1.5" fill="#94A3B8" />
      <rect x="112" y="50" width="56" height="42" rx="10" fill="#F1F5F9" />
      <rect x="118" y="58" width="44" height="3" rx="1.5" fill="#64748B" />
      <rect x="118" y="65" width="36" height="3" rx="1.5" fill="#64748B" />
      <rect x="118" y="72" width="40" height="3" rx="1.5" fill="#64748B" />
      <rect x="118" y="82" width="44" height="3" rx="1.5" fill="#E11D48" />
      <rect x="116" y="116" width="48" height="22" rx="11" fill="#E11D48" />
      <text x="128" y="131" fontSize="9" fill="white" fontWeight="600">
        Open form
      </text>
    </svg>
  );
}

function StepThreeArt() {
  return (
    <svg
      viewBox="0 0 280 180"
      className="w-full h-44 rounded-xl bg-rose-50/60"
      role="img"
      aria-label="Side panel showing the completed client card"
    >
      <rect x="80" y="20" width="120" height="140" rx="10" fill="white" stroke="#E2E8F0" />
      <circle cx="94" cy="38" r="7" fill="#DCFCE7" />
      <path d="M91 38 L93.5 40.5 L98 36" stroke="#16A34A" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="106" y="35" width="48" height="6" rx="3" fill="#0F172A" />
      <rect x="160" y="32" width="32" height="14" rx="7" fill="#E11D48" />
      <text x="166" y="42" fontSize="7" fill="white" fontWeight="600">
        Copy all
      </text>
      <rect x="92" y="58" width="32" height="4" rx="2" fill="#94A3B8" />
      <rect x="92" y="66" width="80" height="4" rx="2" fill="#0F172A" />
      <rect x="92" y="80" width="28" height="4" rx="2" fill="#94A3B8" />
      <rect x="92" y="88" width="70" height="4" rx="2" fill="#0F172A" />
      <rect x="92" y="102" width="34" height="4" rx="2" fill="#94A3B8" />
      <rect x="92" y="110" width="64" height="4" rx="2" fill="#0F172A" />
      <rect x="92" y="124" width="26" height="4" rx="2" fill="#94A3B8" />
      <rect x="92" y="132" width="58" height="4" rx="2" fill="#0F172A" />
      <rect x="92" y="146" width="40" height="4" rx="2" fill="#94A3B8" />
      <rect x="92" y="154" width="76" height="4" rx="2" fill="#0F172A" />
    </svg>
  );
}

function PrivacyArt() {
  return (
    <svg
      viewBox="0 0 280 220"
      className="w-full h-56 sm:h-64"
      role="img"
      aria-label="Phone showing a form being filled in privately"
    >
      <defs>
        <linearGradient id="privacy-glow" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#E11D48" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#E11D48" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="140" cy="110" r="100" fill="url(#privacy-glow)" />
      <rect x="100" y="20" width="80" height="170" rx="14" fill="white" stroke="#1E293B" strokeWidth="1.5" />
      <rect x="124" y="26" width="32" height="3" rx="1.5" fill="#CBD5E1" />
      <rect x="110" y="42" width="60" height="3" rx="1.5" fill="#0F172A" />
      <rect x="110" y="50" width="40" height="2.5" rx="1.25" fill="#94A3B8" />
      <rect x="110" y="64" width="60" height="14" rx="4" fill="#F1F5F9" />
      <rect x="114" y="69" width="36" height="3" rx="1.5" fill="#0F172A" />
      <rect x="110" y="84" width="60" height="14" rx="4" fill="#F1F5F9" />
      <rect x="114" y="89" width="48" height="3" rx="1.5" fill="#0F172A" />
      <rect x="110" y="104" width="60" height="14" rx="4" fill="#F1F5F9" />
      <rect x="114" y="109" width="28" height="3" rx="1.5" fill="#0F172A" />
      <rect x="110" y="124" width="60" height="14" rx="4" fill="#F1F5F9" />
      <rect x="114" y="129" width="42" height="3" rx="1.5" fill="#0F172A" />
      <rect x="110" y="156" width="60" height="20" rx="10" fill="#E11D48" />
      <text x="124" y="170" fontSize="9" fill="white" fontWeight="600">
        Submit
      </text>
      <circle cx="200" cy="56" r="22" fill="#E11D48" />
      <rect x="194" y="51" width="12" height="10" rx="2" fill="white" />
      <path d="M197 51 V47 a3 3 0 0 1 6 0 V51" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="200" cy="56" r="1.5" fill="#E11D48" />
    </svg>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="card p-5 group">
      <summary className="cursor-pointer font-semibold list-none flex items-center justify-between">
        {q}
        <span className="text-slate-400 group-open:rotate-45 transition">+</span>
      </summary>
      <p className="mt-3 text-sm text-slate-600 leading-relaxed">{a}</p>
    </details>
  );
}
