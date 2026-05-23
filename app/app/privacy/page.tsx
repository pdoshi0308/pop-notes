import type { Metadata } from 'next';
import { MarketingNav, MarketingFooter } from '@/components/marketing-nav';
import { BRAND, brandUrl } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Privacy Policy · ${BRAND.name}`,
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-brand-bg">
      <MarketingNav />
      <article className="max-w-3xl mx-auto px-5 sm:px-8 py-16 prose-legal">
        <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mt-1">Last updated: {LAST_UPDATED}</p>

        <Section title="Who we are">
          <p>
            {BRAND.name} (&quot;we&quot;, &quot;us&quot;) provides software that
            lets a business send a registration form by SMS and receive the
            completed details. For the personal data a business collects from its
            own clients through {BRAND.name}, that business is the data
            controller and we act as their data processor.
          </p>
          <p>
            Contact:{' '}
            <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.
          </p>
        </Section>

        <Section title="What we collect">
          <ul>
            <li>
              <strong>Account data</strong> — your name, business name, email and
              authentication details when you sign up.
            </li>
            <li>
              <strong>Client submissions</strong> — the form fields your business
              chooses to collect (e.g. name, mobile, date of birth, address, and
              any optional fields you enable). This data belongs to your business.
            </li>
            <li>
              <strong>Usage data</strong> — basic logs needed to operate the
              service securely and meter SMS usage.
            </li>
          </ul>
        </Section>

        <Section title="How we use it">
          <p>
            We use account and usage data to provide, secure, support and bill
            the service. We process client submissions solely on your
            instructions to deliver them to you in real time. We do not sell
            personal data.
          </p>
        </Section>

        <Section title="Sub-processors">
          <p>
            We rely on trusted providers to run the service: hosting and database
            (Supabase, EU region), SMS delivery (Twilio), realtime delivery
            (Pusher), and payments (Stripe). Each processes data only as needed to
            provide their part of the service.
          </p>
        </Section>

        <Section title="Retention &amp; your rights">
          <p>
            We keep data for as long as your account is active or as needed to
            provide the service. Individuals may request access, correction or
            deletion of their data; for client submissions, contact the business
            that collected them. To exercise rights relating to your account,
            email <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy? Email{' '}
            <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> or
            write to us at the address above. This policy is published at{' '}
            <a href={brandUrl('/privacy')}>{BRAND.domain}/privacy</a>.
          </p>
        </Section>
      </article>
      <MarketingFooter />
    </main>
  );
}

const LAST_UPDATED = '23 May 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 space-y-3 text-slate-700 leading-relaxed [&_a]:text-brand-primary [&_a]:font-medium [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}
