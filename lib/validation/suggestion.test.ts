import { describe, expect, it } from 'vitest';
import { zSuggestion, SUGGESTION_MAXLEN } from '@/lib/validation/suggestion';

describe('zSuggestion', () => {
  it('checkbox absente du FormData → signed false (anonyme par défaut sûr)', () => {
    const r = zSuggestion.safeParse({ body: 'Une idée' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.signed).toBe(false);
  });

  it("checkbox cochée ('on') → signed true", () => {
    const r = zSuggestion.safeParse({ body: 'Une idée', signed: 'on' });
    expect(r.success && r.data.signed).toBe(true);
  });

  it('null (FormData.get sur une clé absente) → signed false', () => {
    const r = zSuggestion.safeParse({ body: 'Une idée', signed: null });
    expect(r.success && r.data.signed).toBe(false);
  });

  it("la chaîne 'false' ne doit PAS valoir true (piège de z.coerce.boolean)", () => {
    const r = zSuggestion.safeParse({ body: 'Une idée', signed: 'false' });
    expect(r.success && r.data.signed).toBe(false);
  });

  it('booléen true accepté (appel programmatique)', () => {
    const r = zSuggestion.safeParse({ body: 'Une idée', signed: true });
    expect(r.success && r.data.signed).toBe(true);
  });

  it('corps vide ou trop long refusé, quel que soit signed', () => {
    expect(zSuggestion.safeParse({ body: '   ', signed: 'on' }).success).toBe(false);
    expect(
      zSuggestion.safeParse({ body: 'x'.repeat(SUGGESTION_MAXLEN + 1), signed: 'on' }).success,
    ).toBe(false);
  });
});
