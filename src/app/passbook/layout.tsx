import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Chit Fund Passbook — Member Login',
  description: 'Scan your passbook QR code or log in with your mobile number to access your chit fund account.',
  openGraph: {
    title: 'Chit Fund Passbook Portal',
    description: 'Access your chit fund passbook, payment history, and live auction updates.',
    type: 'website',
  },
};

export default function PassbookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
