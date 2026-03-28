import type { Metadata } from 'next';
import './globals.css';
import LayoutWrapper from '@/components/LayoutWrapper';
import { PWAInstaller } from '@/components/PWAInstaller';

export const metadata: Metadata = {
  title: 'FQ Command Center',
  description: 'Fox & Quinn studio operations hub',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-180x180.png',
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/icon-96x96.png" type="image/png" sizes="96x96" />
        <link rel="apple-touch-icon" href="/icons/icon-180x180.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FQ" />
        <meta name="theme-color" content="#1E1E1E" />
      </head>
      <body className="bg-fq-bg min-h-screen">
        <PWAInstaller />
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
