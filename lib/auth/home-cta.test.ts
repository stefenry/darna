import { describe, expect, it } from 'vitest';
import { homeCta } from '@/lib/auth/home-cta';

describe('homeCta', () => {
  it('pas de session → demander l’accès', () => {
    expect(homeCta(null, 'fr')).toEqual({ kind: 'apply' });
  });

  it('résident → entrer', () => {
    expect(homeCta('/fr/community/', 'fr')).toEqual({ kind: 'enter', href: '/fr/community/' });
  });

  it('co_mod → entrer', () => {
    expect(homeCta('/fr/comod', 'fr')).toEqual({ kind: 'enter', href: '/fr/comod' });
  });

  it('demande en attente → voir ma demande', () => {
    expect(homeCta('/fr/admission/pending', 'fr')).toEqual({
      kind: 'pending',
      href: '/fr/admission/pending',
    });
  });

  it('demande refusée → voir ma demande', () => {
    expect(homeCta('/fr/admission/refused', 'fr')).toEqual({
      kind: 'pending',
      href: '/fr/admission/refused',
    });
  });

  it('connecté sans demande → demander l’accès (il doit postuler)', () => {
    expect(homeCta('/fr/admission', 'fr')).toEqual({ kind: 'apply' });
  });

  it('fonctionne en arabe', () => {
    expect(homeCta('/ar/community/', 'ar')).toEqual({ kind: 'enter', href: '/ar/community/' });
    expect(homeCta('/ar/admission', 'ar')).toEqual({ kind: 'apply' });
    expect(homeCta('/ar/admission/pending', 'ar')).toEqual({
      kind: 'pending',
      href: '/ar/admission/pending',
    });
  });

  it('destination inattendue → entrer plutôt que bloquer', () => {
    expect(homeCta('/fr/autre-chose', 'fr')).toEqual({ kind: 'enter', href: '/fr/autre-chose' });
  });
});
