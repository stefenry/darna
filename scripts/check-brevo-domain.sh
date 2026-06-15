#!/usr/bin/env bash
# Vérifie SPF + DKIM + DMARC pour le domaine sender Brevo.
# Usage: ./scripts/check-brevo-domain.sh darna.org
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: $0 <domain>" >&2
  exit 2
fi

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
RESET='\033[0m'

pass=0
fail=0

check() {
  local label="$1"
  local got="$2"
  local expected_pattern="$3"
  if [[ "$got" =~ $expected_pattern ]]; then
    printf "${GREEN}✓${RESET} %s\n" "$label"
    pass=$((pass + 1))
  else
    printf "${RED}✗${RESET} %s\n  got: %s\n" "$label" "${got:-<empty>}"
    fail=$((fail + 1))
  fi
}

echo "Checking DNS records for ${YELLOW}${DOMAIN}${RESET}…"
echo

# SPF — TXT @ should include spf.sendinblue.com
SPF=$(dig +short TXT "$DOMAIN" | tr -d '"' | grep -i 'v=spf1' | head -1 || true)
check "SPF mentions sendinblue" "$SPF" "spf\.sendinblue\.com"

# DKIM — CNAME mail._domainkey.<domain> should point to brevo
DKIM=$(dig +short CNAME "mail._domainkey.${DOMAIN}" | head -1 || true)
check "DKIM selector 'mail' points to brevo" "$DKIM" "(brevo|domainkey)"

# DMARC — TXT _dmarc.<domain> should contain v=DMARC1
DMARC=$(dig +short TXT "_dmarc.${DOMAIN}" | tr -d '"' | grep -i 'v=DMARC1' | head -1 || true)
check "DMARC policy present" "$DMARC" "v=DMARC1"

echo
echo "Summary: ${pass} passed, ${fail} failed."
exit $(( fail > 0 ? 1 : 0 ))
