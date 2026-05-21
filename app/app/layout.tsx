import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Popform — Send registration forms over SMS',
  description:
    'Popform lets medical and dental receptionists send a registration form to a patient via SMS and receive the completed details back in real time.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen bg-brand-bg text-brand-text antialiased">
        {children}
      </body>
    </html>
  );
}
