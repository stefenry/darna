import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageContainer } from '@/components/layout/page-container';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function TransparencePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('transparency');

  return (
    <PageContainer className="py-12" as="main">
      <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
      <p className="mt-6 text-base text-neutral-400">{t('stub')}</p>
    </PageContainer>
  );
}
