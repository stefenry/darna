// 2026-06-21 — Next 16 rejette les non-async exports en 'use server' file.
import type { CreateArtisanState } from './actions';

export const CREATE_ARTISAN_INITIAL: CreateArtisanState = { ok: false, idle: true };
