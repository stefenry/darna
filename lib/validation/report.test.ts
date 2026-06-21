import { describe, it, expect } from 'vitest';
import {
  zSubmitReport,
  mapReportFieldError,
  REPORT_FIELD_ERROR_KEYS,
  REPORT_NOTE_MAXLEN,
  type ReportErrorableField,
} from './report';

const VALID = {
  target_type: 'artisan',
  target_id: '11111111-1111-4111-8111-111111111111',
  reason: 'spam',
} as const;

describe('zSubmitReport', () => {
  it('accepte un signalement valide sans note', () => {
    const r = zSubmitReport.safeParse(VALID);
    expect(r.success).toBe(true);
  });

  it('accepte une note et la sanitise (strip bidi/control)', () => {
    const r = zSubmitReport.safeParse({ ...VALID, note_text: '  abus‮flip  ' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.note_text).toBe('abusflip');
    }
  });

  it('transforme une note vide / blancs en undefined', () => {
    const r = zSubmitReport.safeParse({ ...VALID, note_text: '   ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.note_text).toBeUndefined();
  });

  it('tronque une note > 200 caractères', () => {
    const r = zSubmitReport.safeParse({ ...VALID, note_text: 'x'.repeat(500) });
    expect(r.success).toBe(true);
    if (r.success) expect((r.data.note_text ?? '').length).toBeLessThanOrEqual(REPORT_NOTE_MAXLEN);
  });

  it('rejette un target_type hors liste', () => {
    const r = zSubmitReport.safeParse({ ...VALID, target_type: 'evil' });
    expect(r.success).toBe(false);
  });

  it('rejette un reason hors liste', () => {
    const r = zSubmitReport.safeParse({ ...VALID, reason: 'parce_que' });
    expect(r.success).toBe(false);
  });

  it('rejette un target_id non-uuid', () => {
    const r = zSubmitReport.safeParse({ ...VALID, target_id: 'not-a-uuid' });
    expect(r.success).toBe(false);
  });
});

describe('mapReportFieldError', () => {
  it('mappe chaque champ faillible vers une clé whitelistée', () => {
    const fields: ReportErrorableField[] = ['target_type', 'target_id', 'reason'];
    for (const f of fields) {
      const key = mapReportFieldError(f);
      expect((REPORT_FIELD_ERROR_KEYS as readonly string[]).includes(key)).toBe(true);
    }
  });
});
