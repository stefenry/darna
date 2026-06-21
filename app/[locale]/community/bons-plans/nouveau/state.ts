// 2026-06-21 — Next 16 rejette les non-async exports en 'use server' file.
import type { CreateTipState } from './actions';

export const CREATE_TIP_INITIAL: CreateTipState = { ok: false, idle: true };
