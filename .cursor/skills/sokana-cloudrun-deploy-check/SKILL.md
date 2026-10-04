---
name: sokana-cloudrun-deploy-check
description:
  Confirms the latest backend push to main is built by Cloud Build and serving
  on the sokana-private-api Cloud Run service. Use after pushing to main, or
  when the user asks whether the latest commit is deployed, live, or on Cloud
  Run.
---

# Confirm a push is deployed on Cloud Run

Pushes to `main` trigger Cloud Build (`cloudbuild.yaml`): `test-gate` →
`buildpack` → `push` → `deploy`. The deploy step tags the image with the full
commit SHA, so a commit is live only when the ready Cloud Run revision's image
ends in `:<sha>`.

- Project: `sokana-private-data`
- Region: `us-central1`
- Service: `sokana-private-api`
- Image:
  `us-central1-docker.pkg.dev/sokana-private-data/cloud-run-source-deploy/backend/sokana-private-api:<sha>`

## Workflow

1. Right after a push, start **one** background check that waits 10 minutes. Do
   not poll in between; the shell completion notification reports the result.
   Run from the backend repo root, outside the sandbox
   (`required_permissions: ["all"]`, `block_until_ms: 0`), because `gcloud`
   writes to `~/.config/gcloud`:

   ```bash
   bash .cursor/skills/sokana-cloudrun-deploy-check/scripts/check-deploy.sh --delay 600
   ```

   Tell the user the check will report in about 10 minutes, then continue with
   other work or end the turn.

   When the user asks for status later, or a push is older than 10 minutes, run
   it without `--delay`. Pass a commit to check something other than
   `origin/main`: `check-deploy.sh c8e35a2`.

2. Read the exit code and the `RESULT:` line:

   | Exit | Meaning                                                          | Next step                                          |
   | ---- | ---------------------------------------------------------------- | -------------------------------------------------- |
   | 0    | Commit serves 100% of traffic and `/health` is 200               | Report deployed                                    |
   | 1    | Build queued/working, or new revision not at 100%                | One more check with `--delay 300`                  |
   | 2    | Build failed, build passed but not deployed, or `/health` failed | Open the build log URL and report the failing step |
   | 3    | No gcloud auth, no build found, or service unreadable            | Fix setup (below)                                  |

3. If the second check is still pending, stop and report the build status and
   log URL instead of checking again.

## Setup problems

- **`gcloud is not authenticated`**: the user must run `gcloud auth login` in
  their own terminal. It is interactive; do not try to run it for them.
- **No build found**: confirm the push landed (`git log origin/main -1`) and
  that the Cloud Build trigger exists for `main`. Builds may be listed in
  `us-central1` or global; the script checks both.
- **Build failed at `test-gate`**: reproduce locally with
  `npm ci && npm run build && npm test -- --runInBand && npm run test:security-smoke`.

## Report format

```markdown
Deploy check for `<short sha>` (<commit subject>):

- Cloud Build: <status> (<build id>)
- Cloud Run: revision <name> serving <percent>% with image `:<short sha>`
- Health: GET /health -> <code>
- Result: <DEPLOYED | PENDING | NOT DEPLOYED> — <one-sentence reason>
```
