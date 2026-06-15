import Image from 'next/image';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { getTranslations } from 'next-intl/server';

type Props = {
  locale: string;
};

function isLocalhost(host: string): boolean {
  return /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host);
}

async function resolveAbsoluteUrl(locale: string): Promise<string> {
  const envBase = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (envBase) {
    return `${envBase}/${locale}/install`;
  }

  const headerList = await headers();
  const forwardedHost = headerList.get('x-forwarded-host');
  const host = forwardedHost ?? headerList.get('host') ?? 'darna.app';
  const forwardedProto = headerList.get('x-forwarded-proto');
  const proto = forwardedProto ?? (isLocalhost(host) ? 'http' : 'https');

  return `${proto}://${host}/${locale}/install`;
}

export async function DesktopInstall({ locale }: Props) {
  const t = await getTranslations('install.desktop');
  const absoluteUrl = await resolveAbsoluteUrl(locale);
  const qrDataUrl = await QRCode.toDataURL(absoluteUrl, { width: 200 });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
          {t('pageTitle')}
        </h1>
        <p className="text-base text-neutral-500">{t('body')}</p>
      </header>

      <div className="flex flex-col items-center gap-4 rounded-[14px] bg-bg-card p-6 shadow-xs">
        <Image
          src={qrDataUrl}
          alt={t('qrAlt', { url: absoluteUrl })}
          width={200}
          height={200}
          priority
          unoptimized
        />
        <p className="text-center text-sm text-neutral-500">{absoluteUrl}</p>
      </div>

      <div className="rounded-[14px] bg-bg-soft p-4 text-sm text-neutral-700">
        <h2 className="text-base font-medium text-neutral-900">{t('instructionsTitle')}</h2>
        <p className="mt-2">{t('instructionsChrome')}</p>
      </div>
    </section>
  );
}
