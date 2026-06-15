import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { PageContainer } from '@/components/layout/page-container';
import { routing } from '@/lib/i18n/routing';
import { detectInstallTarget } from '@/lib/install/detect-os';
import { IOSSafariInstructions } from './ios-safari-instructions';
import { IOSWhatsAppBanner } from './ios-whatsapp-banner';
import { AndroidChromeInstall } from './android-chrome-install';
import { AndroidWebviewInstall } from './android-webview-install';
import { DesktopInstall } from './desktop-install';

type Props = {
  params: Promise<{ locale: string }>;
};

function assertLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'install' });
  return { title: t('pageTitle') };
}

export default async function InstallPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const headerList = await headers();
  const ua = headerList.get('user-agent');
  const target = detectInstallTarget(ua);

  return (
    <PageContainer className="py-10" as="main">
      {target.kind === 'ios-safari' && <IOSSafariInstructions />}
      {target.kind === 'ios-whatsapp-webview' && (
        <>
          <IOSWhatsAppBanner />
          <IOSSafariInstructions />
        </>
      )}
      {target.kind === 'android-chrome' && <AndroidChromeInstall />}
      {target.kind === 'android-webview' && <AndroidWebviewInstall />}
      {target.kind === 'desktop' && <DesktopInstall locale={locale} />}
      {target.kind === 'other-mobile' && <AndroidChromeInstall />}
    </PageContainer>
  );
}
