import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { BRAND, brandUrl } from '@/lib/brand';

export const metadata: Metadata = {
  metadataBase: new URL(brandUrl('')),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  authors: [{ name: BRAND.name, url: brandUrl('') }],
  creator: BRAND.name,
  publisher: BRAND.name,
  keywords: [
    'SMS registration form',
    'client registration',
    'patient registration',
    'WhatsApp registration form',
    'Chrome extension registration',
    'front desk software',
    'UK business software',
    'GDPR-ready registration',
    BRAND.name,
  ],
  alternates: { canonical: brandUrl('') },
  openGraph: {
    type: 'website',
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
    url: brandUrl(''),
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'business',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#E11D48',
};

// JSON-LD structured data — helps search engines understand the product.
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: BRAND.name,
  url: brandUrl(''),
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Chrome Extension',
  description: BRAND.description,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'GBP',
    description: 'Free plan with 10 SMS forms per month',
  },
  publisher: {
    '@type': 'Organization',
    name: BRAND.name,
    url: brandUrl(''),
    email: BRAND.supportEmail,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen bg-brand-bg text-brand-text antialiased">
        <Script
          id="ld-json-organization"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
