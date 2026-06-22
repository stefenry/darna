import { describe, expect, it } from 'vitest';
import {
  isAnnuaireDataPath,
  isCommunityWritePath,
  isDurableContentPath,
  isEphemeralFeedPath,
  isTokenSurfacePath,
} from '@/lib/offline/sw-matchers';

// Story 7.3 — les stratégies de cache du SW reposent sur ces prédicats purs.
describe('SW route matchers (Story 7.3)', () => {
  it('annuaire data = /api/annuaire only', () => {
    expect(isAnnuaireDataPath('/api/annuaire')).toBe(true);
    expect(isAnnuaireDataPath('/api/annuaire/extra')).toBe(false);
    expect(isAnnuaireDataPath('/api/cron')).toBe(false);
  });

  it('durable content matches guide (+ slug, + pack), numeros-utiles, incl. RSC query', () => {
    expect(isDurableContentPath('/fr/community/guide')).toBe(true);
    expect(isDurableContentPath('/fr/community/guide/portail')).toBe(true);
    expect(isDurableContentPath('/fr/community/guide/pack-accueil')).toBe(true);
    expect(isDurableContentPath('/ar/community/numeros-utiles')).toBe(true);
    expect(isDurableContentPath('/fr/community/guide?_rsc=abc')).toBe(true);
    expect(isDurableContentPath('/fr/community/annuaire')).toBe(false);
    expect(isDurableContentPath('/fr/community/alertes')).toBe(false);
  });

  it('ephemeral feeds match alertes and bons-plans', () => {
    expect(isEphemeralFeedPath('/fr/community/alertes')).toBe(true);
    expect(isEphemeralFeedPath('/fr/community/alertes/ma-slug')).toBe(true);
    expect(isEphemeralFeedPath('/ar/community/bons-plans')).toBe(true);
    expect(isEphemeralFeedPath('/fr/community/guide')).toBe(false);
  });

  it('token surfaces are never-cache paths', () => {
    expect(isTokenSurfacePath('/consent/abc')).toBe(true);
    expect(isTokenSurfacePath('/respond/abc')).toBe(true);
    expect(isTokenSurfacePath('/artisan/contact')).toBe(true);
    expect(isTokenSurfacePath('/fr/community/guide')).toBe(false);
    expect(isTokenSurfacePath('/artisan/contactez')).toBe(false);
  });

  it('community write paths are locale-prefixed community routes', () => {
    expect(isCommunityWritePath('/fr/community/alertes/nouveau')).toBe(true);
    expect(isCommunityWritePath('/ar/community/artisan/x/noter')).toBe(true);
    expect(isCommunityWritePath('/community/alertes')).toBe(false);
    expect(isCommunityWritePath('/fr/comod/moderation')).toBe(false);
  });
});
