#!/usr/bin/env bash
# Migrate isolated dev DB, redeploy dev API from latest prod image, rebuild dev frontend.
set -euo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export DEV_ENV_YES=1

bash "${SELF}/run-intake-branding-migration.sh"
bash "${SELF}/deploy-cloudrun.sh"
bash "${SELF}/deploy-frontend.sh"

echo ""
echo "Sokana360 intake (after deploy finishes):"
echo "  https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app/request/sokana360"
