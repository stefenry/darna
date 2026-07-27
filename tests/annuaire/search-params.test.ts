// Retour bêta 2026-07-26 — filtrer l'annuaire par « osmose » renvoyait la liste
// ENTIÈRE. Le paramètre `tag` était validé contre une liste de 8 clés figée dans
// le code : toute compétence absente était rejetée puis neutralisée par `.catch`,
// donc « aucun filtre » au lieu de « ce filtre ».
//
// La liste avait divergé du réel sur trois fronts : les 8 compétences ajoutées
// par la migration `more_tags`, celles créées depuis /comod/admin, et même les
// clés d'origine (`maconnerie` en base, `carrelage` dans le code).

import { describe, expect, it } from 'vitest';
import { parseAnnuaireParams } from '@/app/[locale]/community/annuaire/schema';

describe('parseAnnuaireParams — filtre compétence', () => {
  it('accepte une compétence du seed initial', () => {
    expect(parseAnnuaireParams({ tag: 'plomberie' }).tag).toBe('plomberie');
  });

  it('accepte une compétence ajoutée par migration (more_tags)', () => {
    for (const key of ['solaire', 'iptv_satellite', 'internet_wifi', 'vitrerie']) {
      expect(parseAnnuaireParams({ tag: key }).tag).toBe(key);
    }
  });

  it('accepte une compétence créée par un co_mod depuis l’admin', () => {
    // Slug produit par comod_add_tag : lower(unaccent(label)), non-alphanum → _
    for (const key of ['osmose', 'osmose_inverse', 'pompe_a_chaleur']) {
      expect(parseAnnuaireParams({ tag: key }).tag).toBe(key);
    }
  });

  it('accepte une clé que le code ne connaît pas mais que la base a (maconnerie)', () => {
    expect(parseAnnuaireParams({ tag: 'maconnerie' }).tag).toBe('maconnerie');
  });

  it('neutralise une clé malformée plutôt que de planter', () => {
    for (const bad of [
      'Plomberie',
      'plom berie',
      '../../etc/passwd',
      'tag;drop',
      '_leading',
      'x'.repeat(65),
    ]) {
      expect(parseAnnuaireParams({ tag: bad }).tag).toBeUndefined();
    }
  });

  it('un tableau de valeurs ne garde que la première', () => {
    expect(parseAnnuaireParams({ tag: ['osmose', 'plomberie'] }).tag).toBe('osmose');
  });
});

describe('parseAnnuaireParams — autres filtres inchangés', () => {
  it('prix, facture, note et tri', () => {
    const sp = parseAnnuaireParams({
      q: 'hassan',
      price: '$$',
      facture: 'oui',
      min_rating: '3',
      sort_by: 'recency',
    });
    expect(sp).toMatchObject({
      q: 'hassan',
      price: '$$',
      facture: 'oui',
      min_rating: 3,
      sort_by: 'recency',
    });
  });

  it('valeurs hors domaine neutralisées', () => {
    const sp = parseAnnuaireParams({ price: '€€', facture: 'non', min_rating: '5' });
    expect(sp.price).toBeUndefined();
    expect(sp.facture).toBeUndefined();
    expect(sp.min_rating).toBeUndefined();
  });
});
