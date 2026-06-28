// @vitest-environment node
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Story 7.2 / NFR44 — chaque template e-mail DOIT avoir une variante FR + AR et
// rendre sans erreur dans les deux locales (parité de forme). Ce test couvre
// l'intégralité des templates (les ACs 1.x/2.x/5.x n'en testaient qu'une partie).

import { magicLinkTemplate as magicLinkFr } from '@/lib/email/templates/magic-link.fr';
import { magicLinkTemplate as magicLinkAr } from '@/lib/email/templates/magic-link.ar';
import { admissionNotifyComodTemplate as notifyComodFr } from '@/lib/email/templates/admission-notify-comod.fr';
import { admissionNotifyComodTemplate as notifyComodAr } from '@/lib/email/templates/admission-notify-comod.ar';
import { admissionValidatedTemplate as validatedFr } from '@/lib/email/templates/admission-validated.fr';
import { admissionValidatedTemplate as validatedAr } from '@/lib/email/templates/admission-validated.ar';
import { admissionRejectedTemplate as rejectedFr } from '@/lib/email/templates/admission-rejected.fr';
import { admissionRejectedTemplate as rejectedAr } from '@/lib/email/templates/admission-rejected.ar';
import { artisanConsentAcceptedTemplate as consentAccFr } from '@/lib/email/templates/artisan-consent-accepted.fr';
import { artisanConsentAcceptedTemplate as consentAccAr } from '@/lib/email/templates/artisan-consent-accepted.ar';
import { artisanConsentRefusedTemplate as consentRefFr } from '@/lib/email/templates/artisan-consent-refused.fr';
import { artisanConsentRefusedTemplate as consentRefAr } from '@/lib/email/templates/artisan-consent-refused.ar';
import { reportNotifyComodTemplate as reportNotifyFr } from '@/lib/email/templates/report-notify-comod.fr';
import { reportNotifyComodTemplate as reportNotifyAr } from '@/lib/email/templates/report-notify-comod.ar';
import { contentRemovedAuthorTemplate as removedFr } from '@/lib/email/templates/content-removed-author.fr';
import { contentRemovedAuthorTemplate as removedAr } from '@/lib/email/templates/content-removed-author.ar';
import { reportKeptReporterTemplate as keptFr } from '@/lib/email/templates/report-kept-reporter.fr';
import { reportKeptReporterTemplate as keptAr } from '@/lib/email/templates/report-kept-reporter.ar';
import { escalationLegalTemplate as escalationFr } from '@/lib/email/templates/escalation-legal.fr';
import { escalationLegalTemplate as escalationAr } from '@/lib/email/templates/escalation-legal.ar';
import { suggestionNotifyComodTemplate as suggestionFr } from '@/lib/email/templates/suggestion-notify-comod.fr';
import { suggestionNotifyComodTemplate as suggestionAr } from '@/lib/email/templates/suggestion-notify-comod.ar';
import { exportReadyTemplate as exportReadyFr } from '@/lib/email/templates/export-ready.fr';
import { exportReadyTemplate as exportReadyAr } from '@/lib/email/templates/export-ready.ar';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTpl = (vars: any) => { subject: string; htmlContent: string; textContent: string };

const CASES: { name: string; fr: AnyTpl; ar: AnyTpl; vars: unknown }[] = [
  {
    name: 'magic-link',
    fr: magicLinkFr,
    ar: magicLinkAr,
    vars: { link: 'https://darna.example/x', expiresInMinutes: 15 },
  },
  {
    name: 'admission-notify-comod',
    fr: notifyComodFr,
    ar: notifyComodAr,
    vars: { villa: 12, tranche: 'A', first_name: 'Salma', queue_url: 'https://darna.example/q' },
  },
  {
    name: 'admission-validated',
    fr: validatedFr,
    ar: validatedAr,
    vars: { first_name: 'Salma', villa: 12, magic_link: 'https://darna.example/c' },
  },
  {
    name: 'admission-rejected',
    fr: rejectedFr,
    ar: rejectedAr,
    vars: { villa: 12, motive: 'duplicate' },
  },
  {
    name: 'artisan-consent-accepted',
    fr: consentAccFr,
    ar: consentAccAr,
    vars: { artisanName: 'Yassine', ficheUrl: 'https://darna.example/a' },
  },
  {
    name: 'artisan-consent-refused',
    fr: consentRefFr,
    ar: consentRefAr,
    vars: { artisanName: 'Yassine' },
  },
  {
    name: 'report-notify-comod',
    fr: reportNotifyFr,
    ar: reportNotifyAr,
    vars: {
      target_label: 'Artisan',
      reason_label: 'Diffamation',
      note_text: null,
      queue_url: 'https://darna.example/q',
    },
  },
  {
    name: 'content-removed-author',
    fr: removedFr,
    ar: removedAr,
    vars: { content_label: 'Avis', motive_label: 'Hors-sujet' },
  },
  { name: 'report-kept-reporter', fr: keptFr, ar: keptAr, vars: { content_label: 'Avis' } },
  {
    name: 'escalation-legal',
    fr: escalationFr,
    ar: escalationAr,
    vars: { summary: 'Résumé', dossier_url: null, dossier_inline: '# dossier' },
  },
  {
    name: 'suggestion-notify-comod',
    fr: suggestionFr,
    ar: suggestionAr,
    vars: { excerpt: 'Une idée', queue_url: 'https://darna.example/q' },
  },
  {
    name: 'export-ready',
    fr: exportReadyFr,
    ar: exportReadyAr,
    vars: { download_url: 'https://darna.example/export.json' },
  },
];

describe('all email templates render in FR and AR (NFR44)', () => {
  for (const { name, fr, ar, vars } of CASES) {
    it(`${name}: FR + AR both render non-empty subject/html/text with parity`, () => {
      const outFr = fr(vars);
      const outAr = ar(vars);
      for (const out of [outFr, outAr]) {
        expect(out.subject).toBeTypeOf('string');
        expect(out.subject.length).toBeGreaterThan(0);
        expect(out.htmlContent).toBeTypeOf('string');
        expect(out.htmlContent.length).toBeGreaterThan(0);
        expect(out.textContent).toBeTypeOf('string');
        expect(out.textContent.length).toBeGreaterThan(0);
      }
      expect(Object.keys(outAr).sort()).toEqual(Object.keys(outFr).sort());
    });
  }
});

describe('FR43 — no marketing template ships in lib/email/templates', () => {
  it('the templates directory contains only the known transactional set', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const dir = resolve(here, '../../lib/email/templates');
    const bases = new Set(
      readdirSync(dir)
        .filter((f) => f.endsWith('.fr.ts') || f.endsWith('.ar.ts'))
        .map((f) => f.replace(/\.(fr|ar)\.ts$/, '')),
    );
    const expected = new Set(CASES.map((c) => c.name));
    // Every shipped template must be a known transactional template (no marketing/promo).
    expect([...bases].sort()).toEqual([...expected].sort());
  });
});
