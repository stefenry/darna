// 2026-06-21 — Next 16 rejette les non-async exports en 'use server' file.
import type { RatingState, RetractRatingState } from './actions';

export const RATING_INITIAL: RatingState = { ok: false, idle: true };
export const RETRACT_RATING_INITIAL: RetractRatingState = { ok: false, idle: true };
