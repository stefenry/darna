// 2026-06-21 — Next 16 rejette les non-async exports en 'use server' file.
import type { CreateAlertState } from './actions';

export const CREATE_ALERT_INITIAL: CreateAlertState = { ok: false, idle: true };
