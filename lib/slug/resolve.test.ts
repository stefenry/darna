import { describe, it, expect } from 'vitest';
import { resolveUniqueSlug } from './resolve';

describe('resolveUniqueSlug', () => {
  it('aucune collision → slug de base', async () => {
    expect(await resolveUniqueSlug('Hassan le Plombier', async () => [])).toBe(
      'hassan-le-plombier',
    );
  });

  it('collision → suffixe -2, -3…', async () => {
    expect(await resolveUniqueSlug('Hassan le Plombier', async () => ['hassan-le-plombier'])).toBe(
      'hassan-le-plombier-2',
    );
    expect(
      await resolveUniqueSlug('Hassan le Plombier', async () => [
        'hassan-le-plombier',
        'hassan-le-plombier-2',
      ]),
    ).toBe('hassan-le-plombier-3');
  });

  it('nom non translittérable (slug vide) → fallback artisan', async () => {
    expect(await resolveUniqueSlug('😀🎉', async () => [])).toBe('artisan');
    expect(await resolveUniqueSlug('😀🎉', async () => ['artisan'])).toBe('artisan-2');
  });

  it('le lookup reçoit bien la base slugifiée', async () => {
    let received = '';
    await resolveUniqueSlug('Électricité Générale', async (b) => {
      received = b;
      return [];
    });
    expect(received).toBe('electricite-generale');
  });
});
