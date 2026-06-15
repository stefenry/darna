import { getTranslations } from 'next-intl/server';

export async function AndroidWebviewInstall() {
  const t = await getTranslations('install.androidWebview');

  const steps = [
    { key: 1, title: t('step1Title'), body: t('step1Body') },
    { key: 2, title: t('step2Title'), body: t('step2Body') },
  ];

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
          {t('pageTitle')}
        </h1>
        <p className="text-base text-neutral-500">{t('intro')}</p>
      </header>

      <ol className="flex flex-col gap-4">
        {steps.map(({ key, title, body }) => (
          <li key={key} className="flex flex-col gap-3 rounded-[14px] bg-bg-card p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent-500 text-sm font-semibold text-white">
                {key}
              </span>
              <h2 className="text-base font-medium text-neutral-900">{title}</h2>
            </div>
            <p className="text-base text-neutral-700">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
