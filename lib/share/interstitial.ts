// Story 6.1/6.3 — rendu HTML auto-porté des pages d'entrée canoniques (route
// handlers, hors next-intl). Pourquoi du HTML inline et pas un composant React :
// ces routes doivent émettre des STATUS HTTP précis (200 teaser, 404 introuvable,
// 410 tombstone) — impossible depuis une page App Router. Le document est minimal,
// brandé (vert sage), bilingue, sans dépendance au pipeline CSS (rapide, pré-auth).

import type { Locale } from '@/lib/i18n/config';
import type { ShareKind } from './entities';

type Variant = 'gone' | 'not-found' | 'teaser';

type Strings = {
  brand: string;
  goneTitle: string;
  goneBody: string;
  notFoundTitle: string;
  notFoundBody: string;
  teaserLead: string;
  teaserCta: string;
  kind: Record<ShareKind, string>;
};

// Strings inlinés (FR + AR) : peu nombreux, propres à l'interstitiel. AR fourni
// (la page d'entrée peut arriver via un partage en arabe même au MVP FR-only).
const STRINGS: Record<Locale, Strings> = {
  fr: {
    brand: 'Darna',
    goneTitle: 'Ce contenu n’est plus disponible',
    goneBody: 'Il a peut-être été retiré par son auteur ou avoir expiré.',
    notFoundTitle: 'Page introuvable',
    notFoundBody: 'Ce lien ne correspond à aucun contenu.',
    teaserLead: 'Contenu réservé aux résidents de la communauté.',
    teaserCta: 'S’inscrire pour voir',
    kind: { artisan: 'Artisan', alert: 'Alerte', tip: 'Bon plan', guide_entry: 'Guide' },
  },
  ar: {
    brand: 'دارنا',
    goneTitle: 'هذا المحتوى لم يعد متاحًا',
    goneBody: 'ربما تمت إزالته من طرف صاحبه أو انتهت صلاحيته.',
    notFoundTitle: 'الصفحة غير موجودة',
    notFoundBody: 'هذا الرابط لا يطابق أي محتوى.',
    teaserLead: 'محتوى مخصّص لقاطني الإقامة.',
    teaserCta: 'سجّل للاطّلاع',
    kind: { artisan: 'حِرفي', alert: 'تنبيه', tip: 'عرض جيد', guide_entry: 'دليل' },
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type InterstitialInput = {
  locale: Locale;
  variant: Variant;
  /** teaser : type d'entité (badge). */
  kind?: ShareKind;
  /** teaser : titre de l'entité (échappé). */
  title?: string;
  /** teaser : sous-titre (catégorie/tag, échappé). */
  subtitle?: string | null;
  /** teaser : href du CTA d'inscription (déjà construit, avec `?next=`). */
  ctaHref?: string;
};

/** Document HTML complet (`<!doctype html>…`) pour la réponse du route handler. */
export function renderInterstitial(input: InterstitialInput): string {
  const { locale, variant } = input;
  const s = STRINGS[locale] ?? STRINGS.fr;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  let heading = '';
  let body = '';
  if (variant === 'gone') {
    heading = s.goneTitle;
    body = s.goneBody;
  } else if (variant === 'not-found') {
    heading = s.notFoundTitle;
    body = s.notFoundBody;
  }

  const teaser =
    variant === 'teaser' && input.title
      ? `
        <div class="card">
          ${input.kind ? `<span class="badge">${escapeHtml(s.kind[input.kind])}</span>` : ''}
          <h2 class="entity">${escapeHtml(input.title)}</h2>
          ${input.subtitle ? `<p class="sub">${escapeHtml(input.subtitle)}</p>` : ''}
        </div>
        <p class="lead">${escapeHtml(s.teaserLead)}</p>
        ${input.ctaHref ? `<a class="cta" href="${escapeHtml(input.ctaHref)}">${escapeHtml(s.teaserCta)}</a>` : ''}
      `
      : `
        <h2 class="entity">${escapeHtml(heading)}</h2>
        <p class="lead">${escapeHtml(body)}</p>
      `;

  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${escapeHtml(s.brand)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100dvh; display: flex; align-items: center; justify-content: center;
    background: #FBFAF6; color: #1A1812; padding: 24px;
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; line-height: 1.5;
  }
  main { width: 100%; max-width: 28rem; display: flex; flex-direction: column; gap: 16px; text-align: center; }
  .brand { font-weight: 700; letter-spacing: -0.01em; color: #4A8255; font-size: 20px; }
  .card {
    display: flex; flex-direction: column; gap: 6px; align-items: center;
    background: #FFFFFF; border-radius: 14px; padding: 20px;
    box-shadow: 0 6px 18px rgba(20, 18, 14, 0.06);
  }
  .badge {
    align-self: center; font-size: 12px; font-weight: 600; color: #4A8255;
    background: #D5E8DA; border-radius: 10px; padding: 2px 10px;
  }
  .entity { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
  .sub { margin: 0; color: #6E6A5C; font-size: 15px; }
  .lead { margin: 0; color: #6E6A5C; font-size: 15px; }
  .cta {
    display: inline-flex; align-items: center; justify-content: center; min-height: 48px;
    padding: 0 24px; border-radius: 14px; background: #5B9C66; color: #fff;
    font-weight: 600; text-decoration: none;
  }
  .cta:hover { background: #4A8255; }
  .cta:focus-visible { outline: 2px solid #3B6944; outline-offset: 2px; }
</style>
</head>
<body>
<main>
  <span class="brand">${escapeHtml(s.brand)}</span>
  ${teaser}
</main>
</body>
</html>`;
}
