'use server';

// Gestion des compétences artisan (spec 2026-07-23-comod-tags-admin-design.md).
// Écritures via RPC SECURITY DEFINER (table `tags` GLOBALE — pas de policy
// d'écriture ouverte) : les gardes co_mod / dédup / slug vivent en SQL, l'action
// mappe les codes d'erreur. Client SESSION, pattern removeResident.

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireComod } from '@/lib/auth/require-comod';
import { log } from '@/lib/logger';
import type { TagActionState, TagErrorCode } from './tags-state';

const KNOWN_CODES = ['forbidden', 'invalid_label', 'duplicate', 'not_found'] as const;

function mapRpcError(message: string): TagErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(message)
    ? (message as TagErrorCode)
    : 'failed';
}

function revalidateTagSurfaces(): void {
  revalidatePath(`/[locale]/comod/admin/competences`, 'page');
  // Les sélecteurs/filtres lisent la table à chaque rendu — revalider l'annuaire
  // suffit pour voir le nouveau tag sans redéploiement.
  revalidatePath(`/[locale]/community/annuaire`, 'page');
}

export async function addTag(labelFr: string, labelAr: string): Promise<TagActionState> {
  const guard = await requireComod();
  if (!guard.ok) return { ok: false, code: 'forbidden' };

  const trimmed = typeof labelFr === 'string' ? labelFr.trim() : '';
  if (trimmed.length < 2 || trimmed.length > 40) {
    return { ok: false, code: 'invalid_label' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('comod_add_tag', {
    p_label_fr: trimmed,
    p_label_ar: typeof labelAr === 'string' ? labelAr.trim() : '',
  });
  if (error) {
    const code = mapRpcError(error.message);
    log({
      level: code === 'failed' ? 'error' : 'info',
      event: 'comod.tag_add_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: code === 'failed' ? (error.code ?? 'unknown') : code },
    });
    return { ok: false, code };
  }

  const created = data?.[0];
  log({
    level: 'info',
    event: 'comod.tag_added',
    user_id: guard.user.id,
    residence_id: null,
    request_id: null,
    payload: { key: created?.key ?? null },
  });

  revalidateTagSurfaces();
  return { ok: true, key: created?.key };
}

export async function renameTag(
  key: string,
  labelFr: string,
  labelAr: string,
): Promise<TagActionState> {
  const guard = await requireComod();
  if (!guard.ok) return { ok: false, code: 'forbidden' };

  if (typeof key !== 'string' || key.length === 0) {
    return { ok: false, code: 'not_found' };
  }
  const trimmed = typeof labelFr === 'string' ? labelFr.trim() : '';
  if (trimmed.length < 2 || trimmed.length > 40) {
    return { ok: false, code: 'invalid_label' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('comod_rename_tag', {
    p_key: key,
    p_label_fr: trimmed,
    p_label_ar: typeof labelAr === 'string' ? labelAr.trim() : '',
  });
  if (error) {
    const code = mapRpcError(error.message);
    log({
      level: code === 'failed' ? 'error' : 'info',
      event: 'comod.tag_rename_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: code === 'failed' ? (error.code ?? 'unknown') : code, key },
    });
    return { ok: false, code };
  }

  log({
    level: 'info',
    event: 'comod.tag_renamed',
    user_id: guard.user.id,
    residence_id: null,
    request_id: null,
    payload: { key },
  });

  revalidateTagSurfaces();
  return { ok: true, key };
}
