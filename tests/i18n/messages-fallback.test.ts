import { describe, expect, it } from 'vitest';
import frMessages from '@/messages/fr.json';
import arMessages from '@/messages/ar.json';

// Story 7.5 (AC4/AC6, FR48/NFR47) — le fallback FR doit être COMPLET : aucune
// chaîne d'UI ne doit jamais s'afficher vide, en `undefined` ou en clé brute.
// On reproduit ici le deepMerge de lib/i18n/request.ts (FR base, AR override,
// stub AR vide → on garde FR) et on vérifie les invariants.

type Messages = Record<string, unknown>;

function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const key of Object.keys(override)) {
    const a = out[key];
    const b = override[key];
    if (
      a &&
      typeof a === 'object' &&
      !Array.isArray(a) &&
      b &&
      typeof b === 'object' &&
      !Array.isArray(b)
    ) {
      out[key] = deepMerge(a as Messages, b as Messages);
    } else if (typeof b === 'string' && b.length === 0 && key in out) {
      // stub AR vide → on garde la valeur FR
    } else {
      out[key] = b;
    }
  }
  return out;
}

function flatten(obj: Messages, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Messages, path));
    } else {
      out[path] = value;
    }
  }
  return out;
}

describe('AR → FR message fallback (Story 7.5)', () => {
  const merged = deepMerge(frMessages as Messages, arMessages as Messages);
  const flatMerged = flatten(merged);
  const flatFr = flatten(frMessages as Messages);

  it('every FR key survives the merge (no AR stub drops a key)', () => {
    for (const key of Object.keys(flatFr)) {
      expect(
        Object.prototype.hasOwnProperty.call(flatMerged, key),
        `key ${key} missing after merge`,
      ).toBe(true);
    }
  });

  it('no merged string is empty, undefined, null, or a raw dotted key path', () => {
    for (const [key, value] of Object.entries(flatMerged)) {
      expect(value, `key ${key} is not a string`).toBeTypeOf('string');
      const str = value as string;
      expect(str.length, `key ${key} resolved to an empty string`).toBeGreaterThan(0);
      expect(str).not.toBe('undefined');
      // A value that is literally its own dotted key path = unresolved placeholder.
      expect(str, `key ${key} looks like an unresolved key path`).not.toBe(key);
    }
  });

  it('an empty AR stub falls back to the FR value (e.g. profil.notifications.title)', () => {
    expect(flatMerged['profil.notifications.title']).toBe(flatFr['profil.notifications.title']);
    expect(flatMerged['profil.notifications.title']).toBe('Notifications');
  });

  it('a populated AR translation overrides FR (e.g. community.numerosUtiles.notTranslatedBadge)', () => {
    expect(flatMerged['community.numerosUtiles.notTranslatedBadge']).toBe('غير مترجم');
    // And the FR base is unchanged for the same key.
    expect(flatFr['community.numerosUtiles.notTranslatedBadge']).toBe('Non traduit');
  });
});
