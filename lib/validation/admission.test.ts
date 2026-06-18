import { describe, it, expect } from 'vitest';
import {
  zSubmitAdmissionForm,
  zTranche,
  zFirstName,
  mapAdmissionFieldError,
  ADMISSION_FIELD_ERROR_KEYS,
  type AdmissionFieldKey,
} from './admission';

const VALID = {
  villa: 42,
  tranche: 'C' as const,
  first_name: 'Salma',
  email: 'salma@example.org',
  cgu_accepted: true as const,
};

describe('zTranche', () => {
  it('accepte A/B/C/D/E', () => {
    for (const t of ['A', 'B', 'C', 'D', 'E']) {
      expect(zTranche.safeParse(t).success).toBe(true);
    }
  });

  it('refuse une tranche hors enum', () => {
    expect(zTranche.safeParse('F').success).toBe(false);
    expect(zTranche.safeParse('a').success).toBe(false);
    expect(zTranche.safeParse('').success).toBe(false);
  });
});

describe('zFirstName', () => {
  it('trim et accepte les prénoms 1-40 chars', () => {
    expect(zFirstName.safeParse('Salma').data).toBe('Salma');
    expect(zFirstName.safeParse('  Salma  ').data).toBe('Salma');
    expect(zFirstName.safeParse('a'.repeat(40)).success).toBe(true);
  });

  it('refuse vide ou > 40 chars', () => {
    expect(zFirstName.safeParse('').success).toBe(false);
    expect(zFirstName.safeParse('   ').success).toBe(false);
    expect(zFirstName.safeParse('a'.repeat(41)).success).toBe(false);
  });
});

describe('zSubmitAdmissionForm', () => {
  it('accepte une soumission complète valide', () => {
    expect(zSubmitAdmissionForm.safeParse(VALID).success).toBe(true);
  });

  it('refuse villa hors borne (151)', () => {
    const result = zSubmitAdmissionForm.safeParse({ ...VALID, villa: 151 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.villa).toBeDefined();
    }
  });

  it('refuse villa hors borne (0)', () => {
    expect(zSubmitAdmissionForm.safeParse({ ...VALID, villa: 0 }).success).toBe(false);
  });

  it('refuse tranche inconnue', () => {
    const result = zSubmitAdmissionForm.safeParse({ ...VALID, tranche: 'F' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.tranche).toBeDefined();
    }
  });

  it('refuse first_name vide après trim', () => {
    const result = zSubmitAdmissionForm.safeParse({ ...VALID, first_name: '  ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.first_name).toBeDefined();
    }
  });

  it('refuse e-mail malformé', () => {
    const result = zSubmitAdmissionForm.safeParse({ ...VALID, email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toBeDefined();
    }
  });

  it('refuse cgu_accepted=false (L4 mitigation)', () => {
    const result = zSubmitAdmissionForm.safeParse({ ...VALID, cgu_accepted: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.cgu_accepted).toBeDefined();
    }
  });

  it('refuse cgu_accepted undefined', () => {
    const rest: Omit<typeof VALID, 'cgu_accepted'> = (() => {
      const { cgu_accepted: _, ...r } = VALID;
      void _;
      return r;
    })();
    const result = zSubmitAdmissionForm.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe('mapAdmissionFieldError', () => {
  it('mappe chaque champ vers une clé errors.admission.* unique', () => {
    const fields: AdmissionFieldKey[] = ['villa', 'tranche', 'first_name', 'email', 'cgu_accepted'];
    const keys = fields.map(mapAdmissionFieldError);
    // unique
    expect(new Set(keys).size).toBe(fields.length);
    // toutes dans la whitelist
    for (const k of keys) {
      expect((ADMISSION_FIELD_ERROR_KEYS as readonly string[]).includes(k)).toBe(true);
    }
  });
});
