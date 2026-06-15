import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/layout/page-container';

const VALID_DOCUMENTS = ['mentions', 'confidentialite', 'cgu'] as const;
type LegalDocument = (typeof VALID_DOCUMENTS)[number];

type Props = {
  params: Promise<{ locale: string; document: string }>;
};

export function generateStaticParams() {
  return VALID_DOCUMENTS.map((document) => ({ document }));
}

export default async function LegalPage({ params }: Props) {
  const { locale, document } = await params;
  setRequestLocale(locale);

  if (!VALID_DOCUMENTS.includes(document as LegalDocument)) {
    notFound();
  }

  const t = await getTranslations(`legal.${document as LegalDocument}`);

  return (
    <PageContainer className="py-12" as="main">
      <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
      <div className="mt-6 text-base leading-relaxed text-neutral-700">
        <p>{t('content')}</p>
      </div>
    </PageContainer>
  );
}
