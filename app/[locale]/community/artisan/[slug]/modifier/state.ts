// 2026-06-21 — Extracted from actions.ts because Next 16 rejects non-async
// exports in `'use server'` files (only async functions allowed).
import type { UpdateArtisanState, RetractArtisanState } from './actions';

export const UPDATE_ARTISAN_INITIAL: UpdateArtisanState = { ok: false, idle: true };
export const RETRACT_ARTISAN_INITIAL: RetractArtisanState = { ok: false, idle: true };
