// 2026-06-21 — Next 16 rejette les non-async exports en 'use server' file.
import type { SubmitSuggestionState } from './actions';

export const SUGGESTION_INITIAL: SubmitSuggestionState = { ok: false, idle: true };
