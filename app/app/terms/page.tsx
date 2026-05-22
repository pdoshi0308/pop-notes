import type { Metadata } from 'next';
import { MarketingNav, MarketingFooter } from '@/components/marketing-nav';
import { BRAND, brandUrl } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Terms of Service · ${BRAND.name}`,
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-brand-bg">
      <MarketingNav />
      <article className="max-w-3xl mx-auto px-5 sm:px-8 py-16">
        <h1 className="text-3xl font-extrabold tracking-tight">Terms of Service</h1>
        <p className="text-sm text-slate-500 mt-1">Last updated: {LAST_UPDATED}</p>

        <Note />

        <Section title="1. Agreement">
          <p>
            These terms govern your use of {BRAND.name}. By creating an account
            you agree to them on behalf of your business. If you do not agree, do
            not use the service.
          </p>
        </Section>

        <Section title="2. The service">
          <p>
            {BRAND.name} lets your business send a registration form by SMS and
            receive completed submissions. We may update or improve features over
            time. We aim for high availability but do not guarantee uninterrupted
            service.
          </p>
        </Section>

        <Section title="3. Your responsibilities">
          <ul>
            <li>Keep your account credentials secure.</li>
            <li>
              Only send forms to people who expect to hear from you, and comply
              with SMS and marketing rules (including consent requirements).
            </li>
            <li>
              Act as the data controller for the personal data you collect from
              your clients, and have a lawful basis to collect it.
            </li>
            <li>Do not misuse the service or attempt to disrupt it.</li>
          </ul>
        </Section>

        <Section title="4. Plans, billing &amp; SMS allowances">
          <p>
            Paid plans are billed in advance through Stripe. Each plan includes a
            monthly SMS allowance; usage resets each calendar month. You can
            change or cancel your plan at any time; cancellation takes effect at
            the end of the current billing period. Fees already paid are
            non-refundable except where required by law.
          </p>
        </Section>

        <Section title="5. Data protection">
          <p>
            Our handling of personal data is described in our{' '}
            <a href={brandUrl('/privacy')} className="text-brand-primary font-medium">
              Privacy Policy
            </a>
            . For client submissions we act as your processor and process data on
            your instructions.
          </p>
        </Section>

        <Section title="6. Liability">
          <p>
            The service is provided &quot;as is&quot;. To the extent permitted by
            law, our total liability arising from the service is limited to the
            fees you paid in the 12 months before the claim. We are not liable for
            indirect or consequential loss.
          </p>
        </Section>

        <Section title="7. Termination">
          <p>
            You may stop using the service and close your account at any time. We
            may suspend or terminate access for breach of these terms. On
            termination you can request an export of your data within a reasonable
            period.
          </p>
        </Section>

        <Section title="8. Contact">
          <p>
            Questions about these terms? Email{' '}
            <a href={`mailto:${BRAND.supportEmail}`} className="text-brand-primary font-medium">
              {BRAND.supportEmail}
            </a>
            . Governing law: [England &amp; Wales / your jurisdiction].
          </p>
        </Section>
      </article>
      <MarketingFooter />
    </main>
  );
}

const LAST_UPDATED = '22 May 2026';

function Note() {
  return (
    <div className="my-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <strong>Template — needs legal review.</strong> This is a starting point.
      Replace the bracketed placeholders and have a solicitor review it before
      relying on it.
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 space-y-3 text-slate-700 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}
