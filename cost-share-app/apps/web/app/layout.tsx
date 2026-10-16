import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { APP_BRAND_COLOR, APP_BRAND_TITLE } from '@/lib/brand';
import { isRtlLanguage } from '@cost-share/shared';
import { getLocale } from '@/lib/locale';
import { MARKETING_LOCALE_HEADER } from '@/lib/marketingSeo';
import './globals.css';

export const metadata: Metadata = {
  title: APP_BRAND_TITLE,
  applicationName: APP_BRAND_TITLE,
  description: 'Split expenses with friends',
  metadataBase: new URL('https://kupa-pay.com'),
  appleWebApp: {
    capable: true,
    title: APP_BRAND_TITLE,
    statusBarStyle: 'default',
  },
  themeColor: APP_BRAND_COLOR,
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const fromPath = headerStore.get(MARKETING_LOCALE_HEADER);
  const locale = fromPath ? await getLocale(fromPath) : await getLocale();
  const dir = isRtlLanguage(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body className="antialiased bg-white text-gray-900">{children}</body>
    </html>
  );
}
