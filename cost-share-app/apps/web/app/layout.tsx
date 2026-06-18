import type { Metadata } from 'next';
import { APP_BRAND_COLOR, APP_BRAND_TITLE } from '@/lib/brand';
import { getLocale } from '@/lib/locale';
import './globals.css';

export const metadata: Metadata = {
  title: APP_BRAND_TITLE,
  applicationName: APP_BRAND_TITLE,
  description: 'Split expenses with friends',
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
  const locale = await getLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body className="antialiased bg-white text-gray-900">{children}</body>
    </html>
  );
}
