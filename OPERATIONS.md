# Production operations

## Health and alerts

- Production health: `https://dealership-inventory-board.netlify.app/api/health`
- GitHub Actions checks production hourly and opens one alert issue if Netlify or Supabase Auth is unavailable.
- Review Netlify Function logs when the health workflow fails.

## Deployment

- Netlify is connected to the GitHub repository and deploys the `main` branch.
- Pull requests run the GitHub CI workflow before merge.
- Production changes should be merged to `main`; avoid manual production deploys so each release stays traceable to a Git commit.

## Backups

Supabase provides platform backups, but an off-platform export should also be kept periodically.

1. Create a short-lived Supabase secret/service-role key.
2. Set it locally as `SUPABASE_SERVICE_ROLE_KEY`; never place it in frontend or committed files.
3. Run `npm run backup:data -- "D:\secure-backups\inventory-YYYY-MM-DD"`.
4. Encrypt or otherwise protect the backup directory because it contains team emails and inventory history.
5. Delete or rotate the short-lived key after the backup.

Run a restore drill quarterly in a separate Supabase project before treating backups as proven.

## Media migration

The Owner-only Team access panel starts the background Trello migration and reports migrated, remaining, and failed files. Failed files retain the original source URL and an error message for investigation.

Supabase Free permits files up to 50 MB. Files larger than that must be compressed or require a plan that permits a larger object limit.

## Access recovery

- New signups are pending and cannot read inventory until the Owner approves them.
- The Owner account must remain protected and should use MFA on Supabase, Netlify, GitHub, and the email account.
- Password recovery is available from the app sign-in screen.
