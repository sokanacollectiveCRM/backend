#!/usr/bin/env bash
# Confirms a backend commit is built and serving on Cloud Run.
#
# Usage: check-deploy.sh [--delay SECONDS] [commit-sha]
#   Defaults to origin/main after a fetch.
#   --delay waits before checking once (a deploy takes about 10-12 minutes).
#
# Exit codes:
#   0  commit is serving 100% of traffic and /health responds
#   1  not deployed yet (build queued/working, or older revision still serving)
#   2  build for this commit failed, or the commit is serving but /health fails
#   3  setup problem (gcloud auth, missing build, bad input)

set -uo pipefail

PROJECT="${SOKANA_GCP_PROJECT:-sokana-private-data}"
REGION="${SOKANA_GCP_REGION:-us-central1}"
SERVICE="${SOKANA_CLOUD_RUN_SERVICE:-sokana-private-api}"
IMAGE_REPO="${SOKANA_IMAGE_REPO:-$REGION-docker.pkg.dev/$PROJECT/cloud-run-source-deploy/backend/$SERVICE}"

DELAY=0
if [[ "${1:-}" == "--delay" ]]; then
  DELAY="${2:-}"
  [[ "$DELAY" =~ ^[0-9]+$ ]] || { echo "--delay needs a number of seconds"; exit 3; }
  shift 2
fi

# Resolve the commit before waiting so a later push does not change the target.
if [[ $# -ge 1 ]]; then
  SHA="$(git rev-parse "$1" 2>/dev/null)" || { echo "Unknown commit: $1"; exit 3; }
else
  git fetch origin main -q 2>/dev/null || echo "warn: git fetch failed; using local origin/main"
  SHA="$(git rev-parse origin/main)"
fi

if [[ "$DELAY" -gt 0 ]]; then
  echo "Waiting ${DELAY}s before checking ${SHA:0:7}..."
  sleep "$DELAY"
fi
SHORT="${SHA:0:7}"
echo "Commit:  $SHORT ($(git log -1 --format=%s "$SHA" 2>/dev/null))"

if ! gcloud auth print-access-token --project="$PROJECT" >/dev/null 2>&1; then
  echo "gcloud is not authenticated. Run: gcloud auth login"
  exit 3
fi

build_fields='value(id,status,createTime,logUrl)'
build="$(gcloud builds list --project="$PROJECT" --region="$REGION" \
  --filter="substitutions.COMMIT_SHA=$SHA" --limit=1 --format="$build_fields" 2>/dev/null)"
if [[ -z "$build" ]]; then
  build="$(gcloud builds list --project="$PROJECT" \
    --filter="substitutions.COMMIT_SHA=$SHA" --limit=1 --format="$build_fields" 2>/dev/null)"
fi

if [[ -z "$build" ]]; then
  echo "Build:   none found for $SHORT (trigger may not have fired yet)"
  build_status="MISSING"
else
  read -r build_id build_status build_time build_log <<<"$build"
  echo "Build:   $build_status  id=$build_id  created=$build_time"
  echo "         $build_log"
fi

image="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format='value(spec.template.spec.containers[0].image)' 2>/dev/null)"
ready_rev="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format='value(status.latestReadyRevisionName)' 2>/dev/null)"
created_rev="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format='value(status.latestCreatedRevisionName)' 2>/dev/null)"
url="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format='value(status.url)' 2>/dev/null)"

if [[ -z "$ready_rev" ]]; then
  echo "Could not read Cloud Run service $SERVICE in $REGION."
  exit 3
fi

ready_image="$(gcloud run revisions describe "$ready_rev" --project="$PROJECT" --region="$REGION" \
  --format='value(spec.containers[0].image)' 2>/dev/null)"
ready_digest_ref="$(gcloud run revisions describe "$ready_rev" --project="$PROJECT" --region="$REGION" \
  --format='value(status.imageDigest)' 2>/dev/null)"
ready_digest="${ready_digest_ref##*@}"
[[ -z "$ready_digest" && "$ready_image" == *@sha256:* ]] && ready_digest="${ready_image##*@}"

# Revisions may pin the image by digest instead of the commit tag, so resolve
# the commit tag to a digest and compare digests.
commit_digest="$(gcloud artifacts docker images describe "$IMAGE_REPO:$SHA" \
  --format='value(image_summary.digest)' 2>/dev/null)"
traffic="$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format='json(status.traffic)' 2>/dev/null)"
ready_percent="$(printf '%s' "$traffic" | python3 -c '
import json, sys
rev = sys.argv[1]
data = json.load(sys.stdin).get("status", {}).get("traffic", [])
print(sum(t.get("percent", 0) for t in data if t.get("revisionName") == rev or t.get("latestRevision")))
' "$ready_rev" 2>/dev/null)"

echo "Service: $SERVICE  url=$url"
echo "Ready:   $ready_rev  traffic=${ready_percent:-?}%"
echo "Image:   ${ready_image##*/}"
echo "Digest:  serving=${ready_digest:-?}  commit=${commit_digest:-not pushed yet}"
[[ "$created_rev" != "$ready_rev" ]] && echo "Note:    newest revision $created_rev is not ready yet"

serving_commit=false
if [[ "$ready_image" == *":$SHA" ]]; then
  serving_commit=true
elif [[ -n "$commit_digest" && "$ready_digest" == "$commit_digest" ]]; then
  serving_commit=true
fi

if [[ "$serving_commit" == true ]]; then
  if [[ "${ready_percent:-0}" != "100" ]]; then
    echo "RESULT: $SHORT is the ready revision but serves ${ready_percent:-?}% of traffic."
    exit 1
  fi
  health="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url/health" || true)"
  echo "Health:  GET /health -> $health"
  if [[ "$health" == "200" ]]; then
    echo "RESULT: DEPLOYED. $SHORT is serving 100% of traffic."
    exit 0
  fi
  echo "RESULT: $SHORT is serving, but /health returned $health."
  exit 2
fi

case "$build_status" in
  FAILURE|INTERNAL_ERROR|TIMEOUT|CANCELLED|EXPIRED)
    echo "RESULT: NOT DEPLOYED. Build $build_status for $SHORT; Cloud Run still serves ${ready_image##*:}."
    exit 2
    ;;
  MISSING)
    echo "RESULT: NOT DEPLOYED. No build for $SHORT; Cloud Run serves ${ready_image##*:}."
    exit 3
    ;;
  SUCCESS)
    echo "RESULT: NOT DEPLOYED. Build succeeded but Cloud Run serves ${ready_image##*:}."
    exit 2
    ;;
  *)
    echo "RESULT: PENDING. Build is $build_status; Cloud Run still serves ${ready_image##*:}."
    exit 1
    ;;
esac
