// Story 6.1 — helpers d'URLs canoniques + rendu interstitiel (purs, isomorphes).

import { describe, expect, it } from 'vitest';
import { canonicalPath, canonicalUrl, communityPath } from '@/lib/share/canonical';
import { isShareKind, SHARE_KINDS } from '@/lib/share/entities';
import { renderInterstitial } from '@/lib/share/interstitial';

describe('canonical URLs', () => {
  it('canonicalPath = segment court locale-less par type', () => {
    expect(canonicalPath('artisan', 'hassan-plombier')).toBe('/artisan/hassan-plombier');
    expect(canonicalPath('alert', 'coupure-eau-ab12')).toBe('/alerte/coupure-eau-ab12');
    expect(canonicalPath('tip', 'perceuse-xy')).toBe('/bon-plan/perceuse-xy');
    expect(canonicalPath('guide_entry', 'codes-portails')).toBe('/guide/codes-portails');
  });

  it('canonicalUrl est absolu via NEXT_PUBLIC_SITE_URL (sans slash final)', () => {
    expect(canonicalUrl('artisan', 'hassan')).toBe('http://localhost:3000/artisan/hassan');
  });

  it('communityPath cible la fiche authentifiée préfixée locale', () => {
    expect(communityPath('fr', 'tip', 'perceuse-xy')).toBe('/fr/community/bons-plans/perceuse-xy');
    expect(communityPath('ar', 'artisan', 'hassan')).toBe('/ar/community/artisan/hassan');
  });

  it('isShareKind garde les 4 types valides', () => {
    expect(SHARE_KINDS).toHaveLength(4);
    expect(isShareKind('artisan')).toBe(true);
    expect(isShareKind('comment')).toBe(false);
  });
});

describe('renderInterstitial', () => {
  it('410 gone : lang/dir corrects, noindex, pas de CTA', () => {
    const html = renderInterstitial({ locale: 'fr', variant: 'gone' });
    expect(html).toContain('<html lang="fr" dir="ltr">');
    expect(html).toContain('noindex, nofollow');
    expect(html).toContain('n’est plus disponible');
    expect(html).not.toContain('class="cta"');
  });

  it('teaser : titre + sous-titre + CTA d’inscription, titre échappé (anti-XSS)', () => {
    const html = renderInterstitial({
      locale: 'fr',
      variant: 'teaser',
      kind: 'artisan',
      title: 'Hassan <script>',
      subtitle: 'Plombier',
      ctaHref: '/fr/admission?next=%2Fartisan%2Fhassan',
    });
    expect(html).toContain('Hassan &lt;script&gt;');
    expect(html).not.toContain('Hassan <script>');
    expect(html).toContain('Plombier');
    expect(html).toContain('href="/fr/admission?next=%2Fartisan%2Fhassan"');
    expect(html).toContain('Artisan'); // badge type
  });

  it('AR : dir rtl', () => {
    const html = renderInterstitial({ locale: 'ar', variant: 'not-found' });
    expect(html).toContain('dir="rtl"');
  });
});
