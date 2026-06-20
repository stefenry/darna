import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { routing } from '@/lib/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { log } from '@/lib/logger';
import { AlertPublishForm, type TemplateOption } from './_components/alert-publish-form';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

function assertLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'community.alertes' });
  return { title: t('new.title') };
}

async function fetchTemplates(): Promise<TemplateOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('alert_templates')
    .select(
      'template_key, icon, label_fr, label_ar, default_body_fr, default_body_ar, default_duration_hours',
    )
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    key: r.template_key,
    icon: r.icon,
    labelFr: r.label_fr,
    labelAr: r.label_ar,
    bodyFr: r.default_body_fr,
    bodyAr: r.default_body_ar,
    durationHours: r.default_duration_hours,
  }));
}

export default async function NewAlertPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('community.alertes');

  let templates: TemplateOption[] = [];
  let failed = false;
  try {
    templates = await fetchTemplates();
  } catch (error) {
    failed = true;
    log({
      level: 'error',
      event: 'alerts.templates_fetch_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: (error as { code?: string })?.code ?? 'unknown' },
    });
  }

  return (
    <section className="flex flex-col gap-5">
      <Link
        href={`/${locale}/community/alertes`}
        aria-label={t('new.back')}
        className="inline-flex min-h-touch min-w-touch w-fit items-center justify-center rounded-[14px] text-neutral-700 hover:bg-bg-soft"
      >
        <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden />
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{t('new.title')}</h1>
        <p className="text-base text-neutral-700">{t('new.intro')}</p>
      </header>

      {failed ? (
        <p role="alert" className="rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-danger">
          {(await getTranslations('errors.alertes'))('fetch_failed')}
        </p>
      ) : (
        <AlertPublishForm templates={templates} locale={locale} />
      )}
    </section>
  );
}
