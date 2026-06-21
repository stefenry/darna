'use server';

// Story 3.5 (Task 4 / AC3/AC4/AC5/AC8) — Server Actions CRUD contenu durable.
// Create/Edit : client SESSION co_mod (RLS `<table>_co_mod_*` + grants colonne 3.1
// = enforcement, défense en profondeur). Retire : RPC SECURITY DEFINER
// `retire_durable_entry` (soft-delete + moderation_log atomiques ; re-check rôle
// + résidence en interne). `residence_id` jamais lu du form (insert : déduit du
// JWT co_mod ; update : tenant figé). `revalidatePath` après chaque mutation.

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireComod } from '@/lib/auth/require-comod';
import { log } from '@/lib/logger';
import { DURABLE_CONFIG, isDurableKind, type DurableKind } from '@/lib/content/admin-config';
import {
  zGuideEntry,
  zUsefulNumber,
  zPackEntry,
  resolveGuideSlug,
  mapDurableFieldError,
} from '@/lib/validation/durable-content';

export type DurableActionState =
  | { ok: true; warning?: 'untranslated' }
  | {
      ok: false;
      code: 'forbidden' | 'invalid_input' | 'submit_failed' | 'not_found' | 'wrong_residence';
      field?: string;
      message_key: string;
    };

type SaveCtx = { kind: DurableKind; id?: string };

function err(
  code: Extract<DurableActionState, { ok: false }>['code'],
  message_key: string,
  field?: string,
): DurableActionState {
  return { ok: false, code, message_key, field };
}

function readForm(kind: DurableKind, fd: FormData): Record<string, unknown> {
  const g = (k: string) => {
    const v = fd.get(k);
    return typeof v === 'string' ? v : undefined;
  };
  if (kind === 'guide') {
    return {
      slug: g('slug'),
      theme_key: g('theme_key'),
      title_fr: g('title_fr'),
      title_ar: g('title_ar'),
      body_fr_markdown: g('body_fr_markdown'),
      body_ar_markdown: g('body_ar_markdown'),
      order_in_theme: g('order_in_theme') ?? 0,
    };
  }
  if (kind === 'numeros') {
    return {
      category_key: g('category_key'),
      label_fr: g('label_fr'),
      label_ar: g('label_ar'),
      phone_e164: g('phone_e164'),
      notes_fr: g('notes_fr'),
      notes_ar: g('notes_ar'),
      order_in_category: g('order_in_category') ?? 0,
    };
  }
  return {
    section_key: g('section_key'),
    title_fr: g('title_fr'),
    title_ar: g('title_ar'),
    body_fr_markdown: g('body_fr_markdown'),
    body_ar_markdown: g('body_ar_markdown'),
    order_in_section: g('order_in_section') ?? 0,
  };
}

/** `true` si la version AR du corps/label est vide → avertissement non bloquant (AC3). */
function isUntranslated(kind: DurableKind, data: Record<string, unknown>): boolean {
  if (kind === 'numeros') return data.label_ar == null;
  return data.body_ar_markdown == null;
}

// useActionState-compatible une fois `.bind(null, ctx)` appliqué côté form.
export async function saveDurableEntry(
  ctx: SaveCtx,
  _prev: DurableActionState,
  formData: FormData,
): Promise<DurableActionState> {
  const guard = await requireComod();
  if (!guard.ok) return err('forbidden', 'errors.comod.forbidden');
  if (!isDurableKind(ctx.kind)) return err('invalid_input', 'errors.comod.content.submit_failed');

  const cfg = DURABLE_CONFIG[ctx.kind];
  const raw = readForm(ctx.kind, formData);
  const schema =
    ctx.kind === 'guide' ? zGuideEntry : ctx.kind === 'numeros' ? zUsefulNumber : zPackEntry;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = String(first?.path[0] ?? '');
    return err('invalid_input', `errors.comod.content.${mapDurableFieldError(path)}`, path);
  }
  const data = parsed.data as Record<string, unknown>;

  const residenceId = (guard.user.app_metadata?.residence_id as string | undefined) ?? undefined;
  if (!ctx.id && !residenceId) {
    return err('submit_failed', 'errors.comod.content.submit_failed');
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  // Construit les payloads insert/update par kind (colonnes distinctes).
  let dbError: { code?: string; message?: string } | null = null;
  // Édition : nombre de lignes effectivement modifiées. Si la RLS filtre la ligne
  // (cross-résidence / retirée), l'UPDATE renvoie 0 ligne sans erreur → on évite
  // un faux succès silencieux.
  let editedRows: number | null = null;
  if (ctx.kind === 'guide') {
    const d = data as {
      slug?: string;
      theme_key: string;
      title_fr: string;
      title_ar: string | null;
      body_fr_markdown: string;
      body_ar_markdown: string | null;
      order_in_theme: number;
    };
    if (ctx.id) {
      const { data: upd, error } = await supabase
        .from('guide_entries')
        .update({
          slug: resolveGuideSlug({ slug: d.slug, title_fr: d.title_fr }),
          theme_key: d.theme_key as never,
          title_fr: d.title_fr,
          title_ar: d.title_ar,
          body_fr_markdown: d.body_fr_markdown,
          body_ar_markdown: d.body_ar_markdown,
          order_in_theme: d.order_in_theme,
          updated_at: now,
        })
        .eq('id', ctx.id)
        .select('id');
      dbError = error;
      editedRows = upd?.length ?? 0;
    } else {
      // `created_by` n'est plus granté à l'insert (review 3.1 P10) : colonne
      // `default auth.uid()`, posée par la DB. La policy `with check (created_by
      // = auth.uid())` reste comme défense en profondeur.
      const { error } = await supabase.from('guide_entries').insert({
        slug: resolveGuideSlug({ slug: d.slug, title_fr: d.title_fr }),
        residence_id: residenceId!,
        theme_key: d.theme_key as never,
        title_fr: d.title_fr,
        title_ar: d.title_ar,
        body_fr_markdown: d.body_fr_markdown,
        body_ar_markdown: d.body_ar_markdown,
        order_in_theme: d.order_in_theme,
      });
      dbError = error;
    }
  } else if (ctx.kind === 'numeros') {
    const d = data as {
      category_key: string;
      label_fr: string;
      label_ar: string | null;
      phone_e164: string;
      notes_fr: string | null;
      notes_ar: string | null;
      order_in_category: number;
    };
    if (ctx.id) {
      const { data: upd, error } = await supabase
        .from('useful_numbers')
        .update({
          category_key: d.category_key as never,
          label_fr: d.label_fr,
          label_ar: d.label_ar,
          phone_e164: d.phone_e164,
          notes_fr: d.notes_fr,
          notes_ar: d.notes_ar,
          order_in_category: d.order_in_category,
          updated_at: now,
        })
        .eq('id', ctx.id)
        .select('id');
      dbError = error;
      editedRows = upd?.length ?? 0;
    } else {
      const { error } = await supabase.from('useful_numbers').insert({
        residence_id: residenceId!,
        category_key: d.category_key as never,
        label_fr: d.label_fr,
        label_ar: d.label_ar,
        phone_e164: d.phone_e164,
        notes_fr: d.notes_fr,
        notes_ar: d.notes_ar,
        order_in_category: d.order_in_category,
      });
      dbError = error;
    }
  } else {
    const d = data as {
      section_key: string;
      title_fr: string;
      title_ar: string | null;
      body_fr_markdown: string;
      body_ar_markdown: string | null;
      order_in_section: number;
    };
    if (ctx.id) {
      const { data: upd, error } = await supabase
        .from('pack_entries')
        .update({
          section_key: d.section_key,
          title_fr: d.title_fr,
          title_ar: d.title_ar,
          body_fr_markdown: d.body_fr_markdown,
          body_ar_markdown: d.body_ar_markdown,
          order_in_section: d.order_in_section,
          updated_at: now,
        })
        .eq('id', ctx.id)
        .select('id');
      dbError = error;
      editedRows = upd?.length ?? 0;
    } else {
      const { error } = await supabase.from('pack_entries').insert({
        residence_id: residenceId!,
        section_key: d.section_key,
        title_fr: d.title_fr,
        title_ar: d.title_ar,
        body_fr_markdown: d.body_fr_markdown,
        body_ar_markdown: d.body_ar_markdown,
        order_in_section: d.order_in_section,
      });
      dbError = error;
    }
  }

  if (dbError) {
    log({
      level: 'error',
      event: 'comod.durable_save_failed',
      user_id: guard.user.id,
      residence_id: residenceId ?? null,
      request_id: null,
      payload: {
        kind: ctx.kind,
        mode: ctx.id ? 'edit' : 'create',
        errorCode: dbError.code ?? 'unknown',
      },
    });
    return err('submit_failed', 'errors.comod.content.submit_failed');
  }

  // Édition filtrée par la RLS (cross-résidence / entrée retirée) → 0 ligne, pas
  // d'erreur : on remonte not_found plutôt qu'un faux succès.
  if (ctx.id && editedRows === 0) {
    return err('not_found', 'errors.comod.content.not_found');
  }

  revalidatePath(`/[locale]/comod/admin/${cfg.readRoute}`, 'page');
  revalidatePath(`/[locale]/community/${cfg.residentRoute}`, 'page');

  return isUntranslated(ctx.kind, data) ? { ok: true, warning: 'untranslated' } : { ok: true };
}

/** Retrait = soft-delete + moderation_log via RPC SECURITY DEFINER (client session). */
export async function retireDurableEntry(
  kind: DurableKind,
  id: string,
  reason: string,
): Promise<DurableActionState> {
  const guard = await requireComod();
  if (!guard.ok) return err('forbidden', 'errors.comod.forbidden');
  if (!isDurableKind(kind)) return err('invalid_input', 'errors.comod.content.submit_failed');

  const cfg = DURABLE_CONFIG[kind];
  const residenceId = (guard.user.app_metadata?.residence_id as string | undefined) ?? null;
  const supabase = await createClient();
  // Motif borné (≤500) : stocké verbatim dans moderation_log — pas de free-text illimité.
  const cleanReason = reason?.trim() ? reason.trim().slice(0, 500) : '';
  const { error } = await supabase.rpc('retire_durable_entry', {
    p_kind: cfg.dbKind,
    p_id: id,
    p_reason: cleanReason,
  });

  if (error) {
    log({
      level: 'warn',
      event: 'comod.durable_retire_failed',
      user_id: guard.user.id,
      residence_id: residenceId,
      request_id: null,
      payload: { kind, reason: error.message ?? 'unknown' },
    });
    return mapRetireError(error.message);
  }

  revalidatePath(`/[locale]/comod/admin/${cfg.readRoute}`, 'page');
  revalidatePath(`/[locale]/community/${cfg.residentRoute}`, 'page');
  return { ok: true };
}

function mapRetireError(message: string | undefined): DurableActionState {
  switch (message) {
    case 'not_co_mod':
      return err('forbidden', 'errors.comod.forbidden');
    case 'wrong_residence':
      return err('wrong_residence', 'errors.comod.content.wrong_residence');
    case 'not_found':
      return err('not_found', 'errors.comod.content.not_found');
    default:
      return err('submit_failed', 'errors.comod.content.submit_failed');
  }
}
