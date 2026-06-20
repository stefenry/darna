import { describe, it, expect } from 'vitest';
import { diffTagKeys } from './diff-tags';

describe('diffTagKeys', () => {
  it('calcule ajouts et retraits', () => {
    const { toAdd, toRemove } = diffTagKeys(
      ['plomberie', 'electricite'],
      ['plomberie', 'peinture'],
    );
    expect(toAdd).toEqual(['peinture']);
    expect(toRemove).toEqual(['electricite']);
  });
  it('aucun changement → diffs vides', () => {
    const { toAdd, toRemove } = diffTagKeys(['plomberie'], ['plomberie']);
    expect(toAdd).toEqual([]);
    expect(toRemove).toEqual([]);
  });
  it('depuis vide → tout en ajout', () => {
    const { toAdd, toRemove } = diffTagKeys([], ['plomberie', 'peinture']);
    expect(toAdd).toEqual(['plomberie', 'peinture']);
    expect(toRemove).toEqual([]);
  });
});
