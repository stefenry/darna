import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/lib/i18n/routing';
import { getDirection, type Locale } from '@/lib/i18n/config';
import { FooterAttribution } from '@/components/layout/footer-attribution';
import { ServiceWorkerUpdater } from '@/components/pwa/sw-updater';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    title: t('title'),
    description: t('description'),
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'Darna',
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = getDirection(locale as Locale);
  const tA11y = await getTranslations('a11y');

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className="antialiased font-sans flex min-h-dvh flex-col">
        {/* Story 7.6 — skip link : 1er élément focusable, masqué jusqu'au focus. */}
        <a
          href="#main-content"
          className="sr-only z-[100] rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {tA11y('skipToContent')}
        </a>
        <NextIntlClientProvider messages={messages}>
          {children}
          <FooterAttribution />
          <ServiceWorkerUpdater />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
