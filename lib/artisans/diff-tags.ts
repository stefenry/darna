// Story 2.7 — diff des compétences à l'édition : quelles clés ajouter / retirer
// sur `artisan_tags` (DELETE puis INSERT). Pur, testable sans I/O.

export function diffTagKeys(
  currentKeys: string[],
  nextKeys: string[],
): { toAdd: string[]; toRemove: string[] } {
  const current = new Set(currentKeys);
  const next = new Set(nextKeys);
  return {
    toAdd: nextKeys.filter((k) => !current.has(k)),
    toRemove: currentKeys.filter((k) => !next.has(k)),
  };
}
