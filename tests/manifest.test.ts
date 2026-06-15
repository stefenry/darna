import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

describe('app/manifest.ts', () => {
  const m = manifest();

  it('exposes the Darna identity strings', () => {
    expect(m.name).toBe('Darna — Communauté de résidence');
    expect(m.short_name).toBe('Darna');
    expect(m.description).toContain('Darna');
  });

  it('uses the v2 theme + background tokens', () => {
    expect(m.theme_color).toBe('#5B9C66');
    expect(m.background_color).toBe('#FBFAF6');
  });

  it('declares standalone PWA shell', () => {
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/');
    expect(m.scope).toBe('/');
    expect(m.orientation).toBe('portrait');
    expect(m.lang).toBe('fr');
    expect(m.dir).toBe('ltr');
  });

  it('ships at least 5 icons including maskable variants', () => {
    expect(m.icons).toBeDefined();
    const icons = m.icons ?? [];
    expect(icons.length).toBeGreaterThanOrEqual(5);

    const maskable = icons.filter((i) => i.purpose === 'maskable');
    expect(maskable.length).toBeGreaterThanOrEqual(2);

    const regular = icons.filter((i) => i.purpose === 'any' || i.purpose === undefined);
    expect(regular.length).toBeGreaterThanOrEqual(3);

    for (const icon of icons) {
      expect(icon.src).toMatch(/^\//);
      expect(icon.sizes).toBeTruthy();
    }
  });
});
