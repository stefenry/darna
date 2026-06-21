// 2026-06-21 — Next 16 rejette les non-async exports en 'use server' file.
import type { ContactLinkState } from './actions';

export const CONTACT_LINK_INITIAL: ContactLinkState = { ok: false, idle: true };
