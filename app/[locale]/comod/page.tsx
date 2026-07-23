// Story 3.5 (Task 7) — hub co_mod : liens vers la file d'admission + le CRUD
// contenu durable (Guide / Numéros / Pack). Garde 403 héritée du comod/layout
// (requireComod) — ne rien affaiblir ici.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  BadgeCheck,
  BookOpen,
  Inbox,
  Phone,
  PackageOpen,
  ShieldAlert,
  Lightbulb,
  FileDown,
  Users,
  Wrench,
} from 'lucide-react';
import { routing } from '@/lib/i18n/routing';
import type { Locale } from '@/lib/i18n/config';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ locale: string }> };

function assertLocale(locale: string): asserts locale is Locale {
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'comod.home' });
  return { title: t('title') };
}

export default async function ComodHomePage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);
  const t = await getTranslations('comod.home');

  const tiles = [
    { key: 'admission', href: `/${locale}/comod/admission`, Icon: Inbox },
    { key: 'artisans', href: `/${locale}/comod/artisans`, Icon: BadgeCheck },
    { key: 'residents', href: `/${locale}/comod/residents`, Icon: Users },
    { key: 'moderation', href: `/${locale}/comod/moderation`, Icon: ShieldAlert },
    { key: 'guide', href: `/${locale}/comod/admin/guide`, Icon: BookOpen },
    { key: 'numeros', href: `/${locale}/comod/admin/numeros-utiles`, Icon: Phone },
    { key: 'pack', href: `/${locale}/comod/admin/pack-accueil`, Icon: PackageOpen },
    { key: 'competences', href: `/${locale}/comod/admin/competences`, Icon: Wrench },
    { key: 'suggestions', href: `/${locale}/comod/suggestions`, Icon: Lightbulb },
    { key: 'transparence', href: `/${locale}/comod/admin/transparence`, Icon: FileDown },
  ] as const;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
      </header>
      <nav className="grid grid-cols-2 gap-3" aria-label={t('title')}>
        {tiles.map(({ key, href, Icon }) => (
          <Link
            key={key}
            href={href}
            className="flex min-h-32 flex-col justify-between rounded-[14px] bg-white p-4 shadow-xs hover:bg-bg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          >
            <Icon className="size-6 text-accent-600" aria-hidden />
            <span className="text-base font-semibold text-neutral-900">{t(`tiles.${key}`)}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}
