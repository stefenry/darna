// Story 8.4 — logique pure de l'export du journal de modération (CSV/JSON).

import { describe, it, expect } from 'vitest';
import {
  toCsv,
  toJson,
  normalizeRangeDate,
  EXPORT_COLUMNS,
  type ModerationExportRow,
} from './moderation';

const HEADERS: Record<string, string> = {
  created_at: 'Date',
  event_key: "Type d'événement",
  actor_pseudonym: 'Auteur (pseudonyme)',
  target_type: 'Type de cible',
  motive_key: 'Motif',
};

const ROWS: ModerationExportRow[] = [
  {
    created_at: '2026-06-20T10:00:00.000Z',
    event_key: 'content_removed',
    actor_pseudonym: 'Voisin·e #42',
    target_type: 'artisan',
    motive_key: 'spam',
  },
];

describe('toCsv', () => {
  it('préfixe le BOM UTF-8 et termine chaque ligne par CRLF', () => {
    const csv = toCsv(ROWS, HEADERS);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM
    expect(csv.includes('\r\n')).toBe(true);
  });

  it('respecte l’ordre des colonnes et localise les en-têtes', () => {
    const csv = toCsv([], HEADERS);
    const headerLine = csv.replace(/^﻿/, '').split('\r\n')[0] ?? '';
    // Apostrophe / parenthèses / espaces ne déclenchent PAS de quote (RFC 4180).
    expect(headerLine).toBe("Date,Type d'événement,Auteur (pseudonyme),Type de cible,Motif");
    expect(headerLine.split(',')[0]).toBe('Date');
    expect(EXPORT_COLUMNS[0]).toBe('created_at');
  });

  it('échappe (RFC 4180) les valeurs contenant virgule, guillemet ou saut de ligne', () => {
    const row: ModerationExportRow = {
      created_at: '2026-06-20T10:00:00.000Z',
      event_key: 'content_removed',
      actor_pseudonym: 'a,b"c\nd',
      target_type: 'artisan',
      motive_key: 'spam',
    };
    const csv = toCsv([row], HEADERS);
    expect(csv).toContain('"a,b""c\nd"');
  });
});

describe('toJson', () => {
  it('encapsule un schéma versionné avec la période et les events', () => {
    const parsed = JSON.parse(
      toJson(ROWS, { from: null, to: null, generatedAt: '2026-06-23T00:00:00.000Z' }),
    );
    expect(parsed.schema_version).toBe('1.0');
    expect(parsed.events).toHaveLength(1);
    expect(parsed.range).toEqual({ from: null, to: null });
  });
});

describe('normalizeRangeDate', () => {
  it('borne début/fin de journée et rejette les formats invalides', () => {
    expect(normalizeRangeDate('2026-06-20')).toBe('2026-06-20T00:00:00.000Z');
    expect(normalizeRangeDate('2026-06-20', true)).toBe('2026-06-20T23:59:59.999Z');
    expect(normalizeRangeDate('not-a-date')).toBeNull();
    expect(normalizeRangeDate(undefined)).toBeNull();
  });
});
