// Types partagés des actions compétences — HORS du fichier 'use server'
// (Next 16 n'y autorise que des fonctions async, cf. state.ts et le fix
// export-state.ts de la page transparence).

export type TagErrorCode = 'forbidden' | 'invalid_label' | 'duplicate' | 'not_found' | 'failed';

export type TagActionState = { ok: true; key?: string } | { ok: false; code: TagErrorCode };
