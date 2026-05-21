/**
 * Brand config — the single source of truth for product name, tagline,
 * domain, and contact details. Every page, email, and API string should
 * read from here. To rename the product, edit this file (and the matching
 * BRAND_NAME in extension/config.js).
 */

export const BRAND = {
  /** Product name. Change here once and the whole app updates. */
  name: 'Popform',

  /** Short positioning line — shows under the wordmark on marketing. */
  tagline: 'SMS-driven patient registration for UK practices',

  /** Longer description used for meta tags / og:description. */
  description:
    'Send a patient registration form by SMS while they are still on the phone. Receive completed details back in real time.',

  /** Production domain (no scheme). Used in marketing copy + email signatures. */
  domain: 'popform.io',

  /** Support email shown in the dashboard + landing footer. */
  supportEmail: 'support@popform.io',

  /** Marketing nav links. Each entry is { label, href }. */
  nav: [
    { label: 'Features', href: '#features' },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ],
} as const;

/** Convenience: the full public URL, derived from `domain`. */
export function brandUrl(path = '/'): string {
  return `https://${BRAND.domain}${path}`;
}
