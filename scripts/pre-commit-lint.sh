#!/usr/bin/env bash
# Mirrors .github/workflows/lint.yaml for local pre-commit checks.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Pre-commit: ESLint (src/security, src/features, src/common/http) ==="
npx eslint --no-error-on-unmatched-pattern src/security src/features src/common/http

echo "=== Pre-commit: Prettier (staged files) ==="
STAGED="$(
  git diff --cached --name-only --diff-filter=ACMR |
    grep -E '\.(ts|tsx|js|jsx|mjs|cjs|json|yml|yaml|md)$' ||
    true
)"

if [ -z "$STAGED" ]; then
  echo "No staged lintable files; skipping Prettier check."
else
  printf '%s\n' "$STAGED"
  # shellcheck disable=SC2086
  npx prettier --check $STAGED
fi

echo "Pre-commit lint checks passed."
