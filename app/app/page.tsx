import Link from 'next/link';
import {
  ArrowRight,
  MessageSquareText,
  Zap,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  ClipboardList,
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
          New for UK businesses
        </span>
        <h1 className="mt-6 text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
          Send registration forms{' '}
          <span className="text-brand-primary">over SMS</span>,<br className="hidden sm:block" />
          get the details back instantly.
        </h1>
        <p className="mt-5 text-lg text-slate-600 max-w-2xl mx-auto">
          {BRAND.name} lets your front desk text a client a registration
          form while they&apos;re on the phone — and watch the completed
          details appear inside Chrome the moment they hit submit.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link href="/signup" className="btn-primary !py-3 !px-5 text-base">
            Start free — 10 SMS/mo <ArrowRight className="w-4 h-4" />
          </Link>
          <a href="#how-it-works" className="btn-secondary !py-3 !px-5 text-base">
            See how it works
          </a>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          No credit card. Cancel any time.
        </p>
      </section>

      {/* Features -------------------------------------------------------- */}
      <section id="features" className="px-5 sm:px-8 max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="Features"
          title="Built for your front desk on a busy phone line"
          sub="Every detail tuned for the moment a client is already on hold."
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
          <Feature
            icon={<MessageSquareText className="w-5 h-5" />}
            title="SMS form delivery"
            body="Clients tap a link, fill it on their phone, no app needed."
          />
          <Feature
            icon={<Zap className="w-5 h-5" />}
            title="Real-time arrival"
            body="The client card animates into Chrome the second they hit submit."
          />
          <Feature
            icon={<Smartphone className="w-5 h-5" />}
            title="Mobile-first client form"
            body="Multi-step, postcode lookup, native autofill — designed for thumbs."
          />
          <Feature
            icon={<ShieldCheck className="w-5 h-5" />}
            title="UK-built &amp; GDPR-ready"
            body="Data lives in EU-hosted Supabase. Per-business isolation by default."
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
              b: 'In the Chrome side panel, type the client’s mobile and hit Send Form.',
            },
            {
              n: 2,
              t: 'Client gets a text',
              b: 'They tap the link and fill in a mobile-optimised form on their phone.',
            },
            {
              n: 3,
              t: 'Data lands in Chrome',
              b: 'A client card pops in with copy buttons. Paste straight into your system.',
            },
          ].map((step) => (
            <li key={step.n} className="card p-5">
              <div className="w-9 h-9 rounded-full bg-rose-50 text-brand-primary flex items-center justify-center font-bold">
                {step.n}
              </div>
              <h3 className="mt-4 font-semibold text-lg">{step.t}</h3>
              <p className="mt-1 text-sm text-slate-600">{step.b}</p>
            </li>
          ))}
        </ol>
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
                Reception is rushed, and some questions feel awkward to ask out
                loud — so they get skipped, and you lose the data. The form asks
                every client, every time. No friction, nothing forgotten.
              </p>
            </div>
            <ul className="space-y-3">
              <AskItem
                icon={<TrendingUp className="w-5 h-5" />}
                q="“How did you hear about us?”"
                body="See which marketing actually brings clients in — captured on every signup instead of guessed."
              />
              <AskItem
                icon={<ShieldCheck className="w-5 h-5" />}
                q="Marketing &amp; contact consent"
                body="Clean opt-ins you can act on, recorded with the submission for GDPR peace of mind."
              />
              <AskItem
                icon={<ClipboardList className="w-5 h-5" />}
                q="The details you always end up chasing"
                body="Full contact, address and custom fields — a complete client record without the phone-tag."
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
          sub="Start free. Upgrade when you outgrow the limit."
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
            a={`Yes. ${BRAND.name} handles SMS sending on every paid plan. Your monthly SMS allowance is included in the price.`}
          />
          <Faq
            q="Does it work with my existing software?"
            a="Yes — your team copies completed details from the Chrome extension into your CRM, booking system, or any tool that takes typed input. A direct integration is on the roadmap."
          />
          <Faq
            q="Can I customise which fields the client sees?"
            a="Yes. The dashboard's form builder lets you toggle fields on/off, mark them required, and reorder them with drag-and-drop."
          />
          <Faq
            q="What if my team closes Chrome before the client submits?"
            a="The extension lives as a Chrome side panel so it stays open while your team switches tabs. If they fully close Chrome, the client submission still arrives next time they open the panel (coming soon)."
          />
          <Faq
            q="Where is client data stored?"
            a="In your own Supabase Postgres instance, hosted in the EU. We don't see the contents of submissions."
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
            Try {BRAND.name} on your next 10 clients free. No credit card.
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
