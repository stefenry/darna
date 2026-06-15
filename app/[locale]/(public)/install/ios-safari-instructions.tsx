import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

export async function IOSSafariInstructions() {
  const t = await getTranslations('install.ios');

  const steps = [
    { key: 1, image: '/install/ios-step-1.png' },
    { key: 2, image: '/install/ios-step-2.png' },
    { key: 3, image: '/install/ios-step-3.png' },
  ] as const;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
          {t('pageTitle')}
        </h1>
        <p className="text-base text-neutral-500">{t('intro')}</p>
      </header>

      <aside className="rounded-[14px] bg-bg-soft p-4 text-sm text-neutral-700" role="note">
        {t('whatsappNotice')}
      </aside>

      <ol className="flex flex-col gap-4">
        {steps.map(({ key, image }) => (
          <li key={key} className="flex flex-col gap-3 rounded-[14px] bg-bg-card p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent-500 text-sm font-semibold text-white">
                {key}
              </span>
              <h2 className="text-base font-medium text-neutral-900">
                {t(`step${key}Title` as 'step1Title' | 'step2Title' | 'step3Title')}
              </h2>
            </div>
            <p className="text-base text-neutral-700">
              {t(`step${key}Body` as 'step1Body' | 'step2Body' | 'step3Body')}
            </p>
            <Image
              src={image}
              alt={t(`step${key}Alt` as 'step1Alt' | 'step2Alt' | 'step3Alt')}
              width={400}
              height={240}
              className="rounded-[10px] border border-bg-soft"
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
