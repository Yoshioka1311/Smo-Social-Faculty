# Deploy from GitHub

GitHub Actions runs tests and can deploy this application to Cloudflare Workers. GitHub Pages alone cannot run the login API, D1 database, or private admin data.

**Deployment is disabled until `CLOUDFLARE_DEPLOY_ENABLED` is set to `true`.** Pushing code runs tests; it does not connect a Cloudflare account.

## One-time setup in the intended Cloudflare account

1. Create D1 database `sh-student-club` and R2 bucket `sh-student-club-files`.
2. In GitHub → Settings → Secrets and variables → Actions, add:

| Type | Name | Value |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | Token for Workers deployment, D1 migrations and R2 bindings |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Intended Cloudflare account ID |
| Variable | `CLOUDFLARE_DATABASE_ID` | Created D1 database UUID |
| Variable | `APP_URL` | HTTPS site origin, e.g. `https://sh-student-club.YOUR-SUBDOMAIN.workers.dev` |
| Variable | `CLOUDFLARE_DEPLOY_ENABLED` | Leave unset while preparing; set to `true` when ready |

3. Configure application secrets (email verification, Google OAuth if used) on the Cloudflare Worker. See `SETUP-CLOUDFLARE.md`. Create the initial administrator using `scripts/create-account.mjs --sql` and execute the generated SQL in D1. Never commit passwords or generated account SQL.
4. When ready, enable deployment and run **Actions → Test and deploy → Run workflow** on `main`. Later pushes to `main` deploy automatically. The workflow applies migrations before deployment.

Local-only student/admin preview access stays disabled in production. Students use their own accounts; only provisioned admin accounts can read all applications.

## Activity applications

Student form: consent → general information and food allergies → camp questions → special skills. Administrators edit camp questions when editing an event, then view submitted answers from the applications page. Existing applications remain readable. Answers preserve the applicant's information as submitted.

Reference: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
