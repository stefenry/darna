// 2026-06-21 — Next 16 rejette les non-async exports en 'use server' file.
import type { DurableActionState } from './durable-content';

export const DURABLE_INITIAL: DurableActionState = { ok: true };
