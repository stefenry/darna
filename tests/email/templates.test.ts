import { describe, expect, it } from 'vitest';
import { magicLinkTemplate as magicLinkFr } from '@/lib/email/templates/magic-link.fr';
import { magicLinkTemplate as magicLinkAr } from '@/lib/email/templates/magic-link.ar';

const vars = { link: 'https://darna.example/auth/confirm?token_hash=abc', expiresInMinutes: 15 };

describe('magic-link templates', () => {
  it('FR returns subject, htmlContent, textContent and includes the link + expiresInMinutes', () => {
    const out = magicLinkFr(vars);
    expect(out.subject).toBeTypeOf('string');
    expect(out.subject.length).toBeGreaterThan(5);
    expect(out.htmlContent).toContain('https://darna.example');
    expect(out.htmlContent).toContain('15');
    expect(out.textContent).toContain('https://darna.example');
    expect(out.textContent).toContain('15');
  });

  it('AR stub matches FR output shape (parity)', () => {
    const fr = magicLinkFr(vars);
    const ar = magicLinkAr(vars);
    expect(Object.keys(ar).sort()).toEqual(Object.keys(fr).sort());
    expect(ar.subject).toBeTypeOf('string');
    expect(ar.htmlContent).toBeTypeOf('string');
    expect(ar.textContent).toBeTypeOf('string');
  });

  it('FR HTML escapes special characters in the link', () => {
    const out = magicLinkFr({
      link: 'https://darna.example/x?a=1&b=<script>',
      expiresInMinutes: 15,
    });
    expect(out.htmlContent).not.toContain('<script>');
    expect(out.htmlContent).toContain('&amp;');
    expect(out.htmlContent).toContain('&lt;script&gt;');
  });
});
