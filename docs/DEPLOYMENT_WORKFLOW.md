# Deployment workflow

Both repositories use the same branch convention:

| Branch | Environment                | Cloud Build configuration | Deployment        |
| ------ | -------------------------- | ------------------------- | ----------------- |
| `dev`  | Isolated dev test site/API | `cloudbuild.dev.yaml`     | Automatic on push |
| `main` | Production site/API        | `cloudbuild.yaml`         | Automatic on push |

## Normal changes

1. Create a feature branch from `dev` and open a pull request into `dev`.
2. Review the CI checks, then merge into `dev`. Cloud Build builds and deploys
   that repository to its dev service. Frontend and backend deploy
   independently.
3. Wait for Cloud Build to succeed, then test the dev site.
4. Open a pull request from `dev` into `main` when the changes are ready for
   production. Review and merge it to trigger the production deployment.

Pushing a feature branch does not deploy it. CI runs for pushes to `dev` and
`main`, and for pull requests targeting either branch. GitHub CI and Cloud Build
are separate runs; a green GitHub check alone does not mean deployment
succeeded. Cloud Build runs frontend unit tests and the sensitive logging check
before building its container. The API pipeline runs the build, tests and
security smoke gate before deploying. Both container builds must compile
successfully.

## Environment mapping

| Repository | Dev service              | Production service   |
| ---------- | ------------------------ | -------------------- |
| `frontend` | `sokana-front-end-dev`   | `sokana-front-end`   |
| `backend`  | `sokana-private-api-dev` | `sokana-private-api` |

Project: `sokana-private-data`. Region: `us-central1`.

- Dev site: https://sokana-front-end-dev-46lcr3n2qa-uc.a.run.app
- Dev API: https://sokana-private-api-dev-46lcr3n2qa-uc.a.run.app
- The frontend dev build points to the dev API and uses Identity Platform auth.
- Dev deployment configurations require branch `dev` and use fixed dev service
  names. They update only the container image, preserving runtime configuration.
- Container images are tagged with the source commit SHA for traceability.
- Local `.env.local` files are excluded from deployment.
- Production trigger settings and production build configuration are unchanged.

Initial dev branches were created from the profile submission/review feature
branches, including the frontend certification fix. These changes are not yet
merged into `main`. Establishing dev deployments does not promote them to
production.

## Checking a deployment

Cloud Build triggers are `frontend-dev` and `backend-dev`; production retains
its existing triggers. Check the matching build in Google Cloud Console, then
confirm Cloud Run's ready revision uses the image tagged with the expected
commit SHA.

If a dev deployment fails, the previous ready revision keeps serving traffic.
Fix the failure and push a new commit to `dev`. To roll back deliberately,
revert the offending commit on `dev` and let the deployment pipeline rebuild it.
