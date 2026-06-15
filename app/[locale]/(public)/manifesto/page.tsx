import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageContainer } from '@/components/layout/page-container';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ManifestoPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('manifesto');

  return (
    <PageContainer className="py-12" as="main">
      <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
      <p className="mt-6 text-lg leading-relaxed text-neutral-500">{t('intro')}</p>

      <section className="mt-10">
        <h2 className="text-xl font-medium text-neutral-900">{t('principles_title')}</h2>
        <ul className="mt-6 space-y-4">
          {(
            [
              'principle_horizontal',
              'principle_privacy',
              'principle_transparency',
              'principle_open',
            ] as const
          ).map((key) => (
            <li
              key={key}
              className="rounded-[14px] bg-bg-card p-4 text-base text-neutral-700 shadow-xs"
            >
              {t(key)}
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}
