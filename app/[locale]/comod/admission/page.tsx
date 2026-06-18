import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageContainer } from '@/components/layout/page-container';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/lib/i18n/routing';
import { log } from '@/lib/logger';
import { AdmissionQueue } from './_components/admission-queue';

// AR37 — polling-à-l'ouverture : re-fetch à chaque navigation (pas de cache SSG,
// pas de WebSocket/Realtime). router.refresh() post-décision re-rend cette page.
export const dynamic = 'force-dynamic';

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
  const t = await getTranslations({ locale, namespace: 'comod.admission' });
  return { title: t('pageTitle') };
}

export default async function ComodAdmissionPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('comod.admission');

  // Lecture via le client SSR session co-mod : la policy RLS
  // admission_requests_co_mod_select filtre nativement par residence_id =
  // auth_residence_id() (zéro fuite cross-résidence, prouve la policy en prod).
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('admission_requests')
    .select('id, villa, tranche, first_name, created_at, email_verified_at')
    .eq('state', 'pending')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    log({
      level: 'error',
      event: 'comod.queue_fetch_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown' },
    });
  }

  const items = data ?? [];

  return (
    <PageContainer className="py-10" as="main">
      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
            {t('pageTitle')}
          </h1>
          <p className="text-base text-neutral-700">{t('intro')}</p>
        </header>

        <AdmissionQueue locale={locale} items={items} />
      </section>
    </PageContainer>
  );
}
