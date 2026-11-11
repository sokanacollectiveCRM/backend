#!/usr/bin/env sh
set -eu

ZERO_SHA=0000000000000000000000000000000000000000

while read -r local_ref local_sha remote_ref remote_sha; do
  [ -n "${local_ref:-}" ] || continue

  base_sha="$remote_sha"
  if [ "$base_sha" = "$ZERO_SHA" ] || ! git cat-file -e "$base_sha^{commit}" 2>/dev/null; then
    base_sha=origin/main
    if ! git cat-file -e "$base_sha^{commit}" 2>/dev/null; then
      base_sha="$local_sha^"
    fi
  fi
  if ! git cat-file -e "$base_sha^{commit}" 2>/dev/null; then
    echo "Cannot find a base commit for the push; fetch the remote branch and retry." >&2
    exit 1
  fi

  changed_files=$(git diff --name-only --diff-filter=ACMR "$base_sha" "$local_sha" | grep -E '\.(ts|tsx|js|jsx|mjs|cjs|json|yml|yaml|md)$' || true)
  if [ -n "$changed_files" ]; then
    echo 'Checking Prettier on files being pushed:'
    printf '%s\n' "$changed_files"
    # Repository paths do not contain spaces.
    # shellcheck disable=SC2086
    npx prettier --check $changed_files
  fi
done

echo 'Checking ESLint on backend security, feature, and HTTP code...'
npx eslint --no-error-on-unmatched-pattern src/security src/features src/common/http
