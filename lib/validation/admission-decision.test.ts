import { describe, expect, it } from 'vitest';
import {
  zValidateAdmission,
  zRejectAdmission,
  zAdmissionDecisionReason,
  ADMISSION_DECISION_REASONS,
} from './admission-decision';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

describe('zValidateAdmission', () => {
  it('accepts a valid UUID', () => {
    const r = zValidateAdmission.safeParse({ admission_request_id: VALID_UUID });
    expect(r.success).toBe(true);
  });

  it('rejects a non-UUID id', () => {
    const r = zValidateAdmission.safeParse({ admission_request_id: 'not-a-uuid' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.admission_request_id).toBeDefined();
    }
  });

  it('rejects a missing id', () => {
    const r = zValidateAdmission.safeParse({});
    expect(r.success).toBe(false);
  });
});

describe('zRejectAdmission', () => {
  it.each(ADMISSION_DECISION_REASONS)('accepts motive "%s"', (motive) => {
    const r = zRejectAdmission.safeParse({ admission_request_id: VALID_UUID, motive });
    expect(r.success).toBe(true);
  });

  it('rejects a missing motive', () => {
    const r = zRejectAdmission.safeParse({ admission_request_id: VALID_UUID });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.motive).toBeDefined();
    }
  });

  it('rejects a motive outside the enum', () => {
    const r = zRejectAdmission.safeParse({
      admission_request_id: VALID_UUID,
      motive: 'spam',
    });
    expect(r.success).toBe(false);
  });

  it('rejects a valid motive with an invalid id', () => {
    const r = zRejectAdmission.safeParse({
      admission_request_id: 'nope',
      motive: 'duplicate',
    });
    expect(r.success).toBe(false);
  });
});

describe('zAdmissionDecisionReason', () => {
  it('mirrors the 4 DB enum values exactly', () => {
    expect([...ADMISSION_DECISION_REASONS].sort()).toEqual(
      ['duplicate', 'incomplete_info', 'manual_review_needed', 'villa_out_of_range'].sort(),
    );
  });

  it('is a 4-value enum', () => {
    expect(zAdmissionDecisionReason.options).toHaveLength(4);
  });
});
