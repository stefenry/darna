import { describe, it, expect } from 'vitest';
import {
  generateDossierMarkdown,
  dossierSummary,
  authorPseudonymFromId,
  scrubThirdPartyPii,
  type DossierInput,
} from './dossier';

const BASE: DossierInput = {
  reportId: '11111111-1111-4111-8111-111111111111',
  targetType: 'rating',
  reason: 'diffamation',
  reporterNote: 'Propos mensongers.',
  contextNote: 'Le contenu cite nommément un voisin de façon diffamatoire.',
  targetTitle: 'Avis',
  targetBody: 'Cet artisan est un escroc notoire.',
  authorPseudonym: authorPseudonymFromId('22222222-2222-4222-8222-222222222abc'),
  reporterPseudonym: authorPseudonymFromId('33333333-3333-4333-8333-333333333def') ?? 'anonyme',
  priorActions: [{ action: 'escalation_triggered', createdAt: '2026-06-20T10:00:00Z' }],
  generatedAtIso: '2026-06-20T12:00:00Z',
};

describe('generateDossierMarkdown', () => {
  it('inclut référence, motif, contenu et contexte', () => {
    const md = generateDossierMarkdown(BASE);
    expect(md).toContain(BASE.reportId);
    expect(md).toContain('Diffamation'); // label FR (pas le code brut `diffamation`)
    expect(md).toContain('escroc notoire');
    expect(md).toContain('diffamatoire');
  });

  it('pseudonymise les parties (pas d’uuid brut ni d’email)', () => {
    const md = generateDossierMarkdown(BASE);
    expect(md).not.toContain('22222222-2222-4222-8222-222222222abc');
    expect(md).not.toContain('@');
    expect(md).toContain('#'); // pseudonyme #XXXXXX
  });

  it('authorPseudonymFromId tronque et masque l’uuid', () => {
    const ps = authorPseudonymFromId('22222222-2222-4222-8222-222222222abc');
    expect(ps).toBe('#222ABC');
    expect(authorPseudonymFromId(null)).toBeNull();
  });

  it('dossierSummary est concis et sans PII', () => {
    const s = dossierSummary(BASE);
    expect(s).toContain(BASE.reportId);
    expect(s).not.toContain('@');
  });

  it('redacte la PII de tiers (e-mail, téléphone) injectée dans les champs libres', () => {
    const md = generateDossierMarkdown({
      ...BASE,
      reporterNote: 'Contacter le voisin à voisin.x@example.com pour confirmer.',
      contextNote: 'Témoin joignable au +212 6 12 34 56 78 selon le signalant.',
    });
    expect(md).not.toContain('voisin.x@example.com');
    expect(md).not.toContain('@');
    expect(md).not.toContain('612345678');
    expect(md).not.toContain('+212 6 12 34 56 78');
    expect(md).toContain('[e-mail masqué]');
    expect(md).toContain('[numéro masqué]');
  });
});

describe('scrubThirdPartyPii', () => {
  it('masque e-mails et numéros, laisse le texte normal intact', () => {
    expect(scrubThirdPartyPii('Propos diffamatoires graves, sans contact.')).toBe(
      'Propos diffamatoires graves, sans contact.',
    );
    expect(scrubThirdPartyPii('écrire à a.b@c.io')).toBe('écrire à [e-mail masqué]');
    expect(scrubThirdPartyPii('appeler 06 12 34 56 78')).toBe('appeler [numéro masqué]');
  });
});
