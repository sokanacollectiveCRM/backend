#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="sokana-private-data"
REGION="us-central1"
REPO="backend-repo"
IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/${REPO}/api:latest"
SERVICE="sokana-private-api"

# Ensure Artifact Registry repo exists (docker format)
if ! gcloud artifacts repositories describe "${REPO}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}"
fi

# Build and push image
gcloud builds submit \
  --project "${PROJECT_ID}" \
  --tag "${IMAGE}"

# Deploy to Cloud Run
gcloud run deploy "${SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --platform managed \
  --allow-unauthenticated=false
