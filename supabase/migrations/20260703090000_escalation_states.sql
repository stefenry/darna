-- Story 5.5 — états juridiques du cycle de vie d'un signalement (escalade).
-- Fichier séparé (ADD VALUE committé avant usage dans les RPC 090100 — pattern
-- 20260701090000). `escalation_triggered` (moderation_action) existe déjà (5.1) ;
-- la résolution juridique réutilise content_kept / content_removed.

alter type public.report_state add value if not exists 'closed_kept_pending_legal';
alter type public.report_state add value if not exists 'closed_kept_legal_approved';
alter type public.report_state add value if not exists 'closed_removed_legal_advised';
