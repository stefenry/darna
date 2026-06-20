import { describe, it, expect } from 'vitest';
import {
  generateDossierMarkdown,
  dossierSummary,
  authorPseudonymFromId,
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
    expect(md).toContain('diffamation');
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
});
