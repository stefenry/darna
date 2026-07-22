// State partagé entre la Server Action (actions.ts) et le form client.
// Vit HORS du fichier 'use server' : Next n'y autorise que des exports de
// fonctions async — exporter la constante initiale depuis actions.ts faisait
// planter la route au runtime (« A "use server" file can only export async
// functions, found object », digest 78866181, cassé depuis le 2026-06-20).

export type ModerationExportState =
  | { ok: null }
  | { ok: false; code: 'forbidden' | 'failed' }
  | { ok: true; mode: 'url'; url: string; filename: string }
  | { ok: true; mode: 'inline'; content: string; filename: string; mime: string };

export const MODERATION_EXPORT_INITIAL: ModerationExportState = { ok: null };
