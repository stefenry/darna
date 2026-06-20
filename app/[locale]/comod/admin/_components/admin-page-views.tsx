// Story 3.5 — vues RSC partagées des pages admin (liste + éditeur). Les 9 routes
// (liste/nouveau/[id] × guide/numeros/pack) délèguent ici pour rester minces.

import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { log } from '@/lib/logger';
import { DURABLE_CONFIG, type DurableKind } from '@/lib/content/admin-config';
import { fetchAdminList, fetchAdminEntry } from '../_data/durable';
import { AdminList } from './admin-list';
import { DurableEntryForm } from './durable-entry-form';

export async function AdminListView({ kind, locale }: { kind: DurableKind; locale: string }) {
  const i18nKey = DURABLE_CONFIG[kind].i18nKey;
  const t = await getTranslations(`comod.admin.${i18nKey}`);

  let items: Awaited<ReturnType<typeof fetchAdminList>> = [];
  let failed = false;
  try {
    items = await fetchAdminList(kind);
  } catch (error) {
    failed = true;
    log({
      level: 'error',
      event: 'comod.durable_list_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { kind, errorCode: (error as { code?: string })?.code ?? 'unknown' },
    });
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
          {t('pageTitle')}
        </h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
      </header>
      {failed ? (
        <p role="alert" className="rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-danger">
          {(await getTranslations('errors.comod.content'))('submit_failed')}
        </p>
      ) : (
        <AdminList kind={kind} items={items} locale={locale} />
      )}
    </section>
  );
}

export async function AdminEditorView({
  kind,
  mode,
  id,
  locale,
}: {
  kind: DurableKind;
  mode: 'create' | 'edit';
  id?: string;
  locale: string;
}) {
  const i18nKey = DURABLE_CONFIG[kind].i18nKey;
  const t = await getTranslations('comod.admin');
  const tModule = await getTranslations(`comod.admin.${i18nKey}`);

  let existing = null;
  if (mode === 'edit' && id) {
    existing = await fetchAdminEntry(kind, id);
    if (!existing) notFound(); // absente ou autre résidence (RLS)
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <a
          href={`/${locale}/comod/admin/${DURABLE_CONFIG[kind].readRoute}`}
          className="text-sm text-accent-600 hover:underline"
        >
          ← {t('backToList')}
        </a>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          {mode === 'create' ? t('newEntry') : t('edit')} — {tModule('pageTitle')}
        </h1>
      </header>
      <DurableEntryForm kind={kind} mode={mode} id={id} existing={existing} locale={locale} />
    </section>
  );
}
