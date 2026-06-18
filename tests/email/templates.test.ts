import { describe, expect, it } from 'vitest';
import { magicLinkTemplate as magicLinkFr } from '@/lib/email/templates/magic-link.fr';
import { magicLinkTemplate as magicLinkAr } from '@/lib/email/templates/magic-link.ar';
import { admissionNotifyComodTemplate as notifyComodFr } from '@/lib/email/templates/admission-notify-comod.fr';
import { admissionNotifyComodTemplate as notifyComodAr } from '@/lib/email/templates/admission-notify-comod.ar';
import { admissionValidatedTemplate as validatedFr } from '@/lib/email/templates/admission-validated.fr';
import { admissionValidatedTemplate as validatedAr } from '@/lib/email/templates/admission-validated.ar';
import { admissionRejectedTemplate as rejectedFr } from '@/lib/email/templates/admission-rejected.fr';
import { admissionRejectedTemplate as rejectedAr } from '@/lib/email/templates/admission-rejected.ar';
import { ADMISSION_DECISION_REASONS } from '@/lib/validation/admission-decision';

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

describe('admission-notify-comod templates', () => {
  const notifyVars = {
    villa: 87,
    tranche: 'C',
    first_name: 'Salma',
    queue_url: 'https://darna.example/fr/comod/admission',
  };

  it('FR returns subject, htmlContent, textContent and includes villa/tranche/first_name/queue_url', () => {
    const out = notifyComodFr(notifyVars);
    expect(out.subject).toContain('87');
    expect(out.subject).toContain('C');
    expect(out.textContent).toContain('Salma');
    expect(out.textContent).toContain('https://darna.example/fr/comod/admission');
    expect(out.htmlContent).toContain('Salma');
    expect(out.htmlContent).toContain('https://darna.example/fr/comod/admission');
  });

  it('AR stub matches FR output shape (parity)', () => {
    const fr = notifyComodFr(notifyVars);
    const ar = notifyComodAr(notifyVars);
    expect(Object.keys(ar).sort()).toEqual(Object.keys(fr).sort());
    expect(ar.subject).toBeTypeOf('string');
    expect(ar.htmlContent).toBeTypeOf('string');
    expect(ar.textContent).toBeTypeOf('string');
  });

  it('FR HTML escapes special characters in first_name and queue_url', () => {
    const out = notifyComodFr({
      villa: 1,
      tranche: 'A',
      first_name: 'Salma <script>alert(1)</script>',
      queue_url: 'https://darna.example/x?a=1&b=2',
    });
    expect(out.htmlContent).not.toContain('<script>alert(1)</script>');
    expect(out.htmlContent).toContain('&lt;script&gt;');
    expect(out.htmlContent).toContain('&amp;');
  });

  it('FR coerces villa defensively (NaN → 0, non-finite)', () => {
    const out = notifyComodFr({
      villa: Number.NaN,
      tranche: 'B',
      first_name: 'Test',
      queue_url: 'https://darna.example/x',
    });
    expect(out.subject).toContain('0');
  });
});

describe('admission-validated templates (story 1.8)', () => {
  const validatedVars = {
    first_name: 'Salma',
    villa: 87,
    magic_link: 'https://darna.example/auth/confirm?t=abc',
  };

  it('FR includes the greeting, villa and magic link', () => {
    const out = validatedFr(validatedVars);
    expect(out.subject.length).toBeGreaterThan(5);
    expect(out.htmlContent).toContain('Salma');
    expect(out.htmlContent).toContain('87');
    expect(out.htmlContent).toContain('https://darna.example/auth/confirm');
    expect(out.textContent).toContain('https://darna.example/auth/confirm');
  });

  it('FR works without first_name (optional)', () => {
    const out = validatedFr({ villa: 12, magic_link: 'https://darna.example/auth/confirm' });
    expect(out.subject).toBeTypeOf('string');
    expect(out.htmlContent).toContain('Bienvenue');
  });

  it('AR stub matches FR output shape (parity)', () => {
    const fr = validatedFr(validatedVars);
    const ar = validatedAr(validatedVars);
    expect(Object.keys(ar).sort()).toEqual(Object.keys(fr).sort());
  });

  it('FR HTML escapes special characters in first_name and magic_link', () => {
    const out = validatedFr({
      first_name: '<script>alert(1)</script>',
      villa: 1,
      magic_link: 'https://darna.example/x?a=1&b=2',
    });
    expect(out.htmlContent).not.toContain('<script>alert(1)</script>');
    expect(out.htmlContent).toContain('&lt;script&gt;');
    expect(out.htmlContent).toContain('&amp;');
  });
});

describe('admission-rejected templates (story 1.8)', () => {
  it('FR renders a distinct neutral phrase for each of the 4 motives', () => {
    const phrases = new Set<string>();
    for (const motive of ADMISSION_DECISION_REASONS) {
      const out = rejectedFr({ villa: 42, motive });
      expect(out.subject).toBeTypeOf('string');
      expect(out.textContent.length).toBeGreaterThan(10);
      phrases.add(out.textContent);
    }
    // 4 motives → 4 distinct bodies.
    expect(phrases.size).toBe(4);
  });

  it('FR escapes villa and contains no magic link (no promotion on reject)', () => {
    const out = rejectedFr({ villa: 203, motive: 'villa_out_of_range' });
    expect(out.htmlContent).toContain('203');
    expect(out.htmlContent).not.toContain('/auth/confirm');
  });

  it('AR stub matches FR output shape (parity)', () => {
    const fr = rejectedFr({ villa: 1, motive: 'duplicate' });
    const ar = rejectedAr({ villa: 1, motive: 'duplicate' });
    expect(Object.keys(ar).sort()).toEqual(Object.keys(fr).sort());
  });
});
