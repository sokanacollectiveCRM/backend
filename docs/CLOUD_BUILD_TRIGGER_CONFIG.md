# Cloud Build trigger and "gcr.io repo does not exist"

## What the repo uses

**This repo does not push to `gcr.io`.** The only build config in the repo is `cloudbuild.yaml` at the repo root, and it pushes to **Artifact Registry**:

- Image: `us-central1-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/backend/sokana-private-api:$COMMIT_SHA`

Git history shows this file has used Artifact Registry since it was added; the app image has never been pushed to `gcr.io` in this repo.

## Why you see "gcr.io repo does not exist"

That error appears when the build that runs **is not** using `cloudbuild.yaml`. In that case Cloud Build uses its default flow and a default image name like:

`gcr.io/sokana-private-data/github.com/sokanacollectivecrm/backend:<commit>`

So the failure is from **how the trigger is configured in GCP**, not from a recent code change.

## What to fix in GCP

1. **Cloud Console → Cloud Build → Triggers**
2. Open the trigger that runs on your branch (e.g. `main` or `phi-compliance-refactor`).
3. **Edit** the trigger.
4. Under **Configuration**:
   - Set **Type** to **"Cloud Build configuration file (yaml or json)"**.
   - Set **Location** to **"Repository"** (or "Cloud Source Repositories" if that’s what you use).
   - Set **Cloud Build configuration file location** to **`cloudbuild.yaml`** (repo root).
5. Save.

If the trigger was set to **Autodetect**, **Dockerfile**, or **Buildpack** without a config file, Cloud Build ignores `cloudbuild.yaml` and uses the default `gcr.io` image name, which leads to the push error.

## Artifact Registry

The config expects this Artifact Registry repo to exist:

- **Name:** `cloud-run-source-deploy`
- **Region:** `us-central1`
- **Project:** your `$PROJECT_ID` (e.g. `sokana-private-data`)

If it doesn’t exist, create it (e.g. in Console: Artifact Registry → Create repository → format **Docker**, region **us-central1**), or ensure the Cloud Build service account has **Artifact Registry Writer** (and, if you want create-on-push, the right permissions for that).

## Summary

- **In the code:** Nothing was changed to introduce `gcr.io`; the repo has always pushed to Artifact Registry via `cloudbuild.yaml`.
- **Fix:** In GCP, set the trigger to use **Cloud Build configuration file** → **`cloudbuild.yaml`** so the build uses Artifact Registry and stops trying to push to `gcr.io`.
