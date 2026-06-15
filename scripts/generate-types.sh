#!/usr/bin/env bash
# Génère lib/supabase/types.generated.ts depuis le schéma Postgres.
# Story 1.3 : snake_case end-to-end (AR8, AR20). Fichier versionné.
#
# Mode local (défaut) : utilise la stack Docker (`supabase start` requis).
# Mode linked : utilise le projet Supabase Cloud lié (`supabase link` requis).
#
# Usage :
#   pnpm gen:types           # mode --local
#   pnpm gen:types -- linked # mode --linked

set -euo pipefail

MODE="${1:-local}"
OUTPUT="lib/supabase/types.generated.ts"
TMP="$OUTPUT.tmp"
HEADER="// AUTO-GENERATED par \`pnpm gen:types\` — DO NOT EDIT.
// Régénérer après chaque migration. Versionné dans git (AR8).
"

# Cleanup du .tmp en cas d'échec — sinon fichier orphelin commité par mégarde
# (review 1.3 — Edge Case #40).
trap 'rm -f "$TMP"' EXIT

case "$MODE" in
  local)
    SUPABASE_FLAG="--local"
    ;;
  linked)
    SUPABASE_FLAG="--linked"
    ;;
  *)
    echo "[gen:types] usage : $0 [local|linked] (reçu : $MODE)" >&2
    exit 2
    ;;
esac

echo "[gen:types] mode $MODE → $OUTPUT"
{
  printf '%s\n' "$HEADER"
  npx supabase@latest gen types typescript "$SUPABASE_FLAG"
} > "$TMP"

# Garde-fou : si npx supabase a échoué silencieusement (stack Docker down,
# auth expiré, etc.), $TMP peut contenir du HTML ou être vide. Sans cette
# vérification, le mv suivant écrase types.generated.ts avec une sortie cassée
# qui fait exploser typecheck — review 1.3 Edge Case #20.
if ! grep -q "export type Database" "$TMP"; then
  echo "[gen:types] ÉCHEC : sortie ne contient pas 'export type Database'." >&2
  echo "[gen:types] Vérifier que 'npx supabase start' tourne (mode local) ou que 'supabase link' est OK (mode linked)." >&2
  exit 3
fi

mv "$TMP" "$OUTPUT"
echo "[gen:types] OK — $(wc -l < "$OUTPUT") lignes générées"
