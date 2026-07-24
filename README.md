# Dealership Inventory Board

A shared React inventory web app built from the supplied Trello export. The original compact seed contained 531 rows; 187 were duplicate URL-only pointers, leaving 344 unique vehicle records.

## Deployment architecture

The inventory board remains the single control centre. It writes to the canonical
PostgreSQL `cars` table, and every customer-facing surface reads from that same
table through the dedicated API.

| Surface | Project directory | Production deployment |
| --- | --- | --- |
| Inventory board | repository root | `dealership-inventory-board.netlify.app` |
| Public vehicle website | `apps/customer-web` (`VITE_SURFACE=site`) | `604-sell-cars-website.netlify.app` |
| Appointment booking | `apps/customer-web` (`VITE_SURFACE=landing`) | `604-sell-cars-booking.netlify.app` |
| Lead desk | `apps/customer-web` (`VITE_SURFACE=admin`) | `604-sell-cars-leads.netlify.app` |
| Shared lead/inventory API | `apps/lead-api` | `604-sell-cars-api.netlify.app` |

These are independent Netlify projects. Updating a car in the inventory board
updates the shared `cars` row; the website and booking deployment read that
change on their next request. Vehicles without a verified physical lot address
remain private until corrected in the board.

## What works

- All 344 unique imported vehicles are seeded into Supabase Postgres.
- Approved team members share one inventory and sign in with Supabase Auth.
- New uploads are stored privately in Supabase Storage and displayed with expiring signed URLs.
- CARFAX URLs are clickable when an actual URL exists.
- Live/sold status, filters, search, editing, deletion, and new inventory persist for the whole team.
- The source seed remains in `src/data/seed.json` for repeatable imports; it is not bundled into the app.

## Refresh from a Trello JSON export

```powershell
npm run import:trello-export -- "C:\path\to\trello-board-export.json"
```

This matches vehicles by their original Trello card IDs, removes duplicate URL-only pointers, restores card names and descriptions, preserves every uploaded vehicle photo in Trello cover-first order using previews up to 1600px, and recovers CARFAX links.

## Run locally

```powershell
npm install
npm run dev
```

The app requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in an ignored `.env` file. Copy `.env.example` and fill those values before starting it.

AI description generation runs through the authenticated Netlify Function at `/api/generate-description`, so the Anthropic key never enters the browser bundle. Add `ANTHROPIC_API_KEY` in **Netlify → Site configuration → Environment variables**, then redeploy. For local function testing, add the same key to the ignored `.env` file and run `npx netlify dev`.

AI generation is server-limited to one request per signed-in user per minute and 10 requests per user per UTC day. Each response is capped at 400 output tokens, and failed rapid/daily-limit requests do not call Anthropic.

## Migrate Trello media to Supabase

New uploads are stored permanently in the private Supabase Storage bucket named `vehicle-media`. The app accepts files up to 50 MB each and uses resumable 6 MB chunks for larger uploads. Existing Trello attachment URLs are delivered through the authenticated `/api/trello-media` function so they work on phones without a Trello browser session; the migration below still moves them into permanent Supabase storage.

Manage the stored files in **Supabase Dashboard → Storage → vehicle-media**. Supabase's Free plan has a 50 MB global per-file ceiling; raising the app above 50 MB also requires a higher global Storage limit on a paid Supabase plan.

Being signed in to Trello in a browser does not automatically authenticate a Node script. Create a read-only Trello API token, copy `.env.example` to `.env`, and set:

```text
TRELLO_API_KEY=your_api_key
TRELLO_API_TOKEN=your_read_only_token
SUPABASE_MIGRATION_EMAIL=your_approved_team_email
SUPABASE_MIGRATION_PASSWORD=your_supabase_password
```

Then run:

```powershell
npm run migrate:media
```

The resumable migration downloads the imported Trello image previews with your authorized API token, uploads them to the private `vehicle-media` bucket, and updates each database record. Never commit `.env`, passwords, or Trello tokens.

The deployed app's Trello media function requires `TRELLO_API_KEY`, `TRELLO_API_TOKEN`, and `TRELLO_MEDIA_SIGNING_SECRET` as encrypted Netlify environment variables. It returns short-lived signed media URLs only to active team accounts.

The older `npm run import:trello` command is still available when you need a fresh API import directly from a board.

The Owner-only **Admin access** panel also includes **Sync every gallery**. It queues only vehicles whose stored image count is below the source card's photo count, so the operation is safe to rerun and does not duplicate completed galleries.

## Refresh inventory classifications

```powershell
npm run classify:inventory
```

This deterministically assigns every vehicle to a body type and adds supported Hybrid, Electric, Diesel, Manual, Performance, Luxury, and Brand New tags from explicit title and description evidence. It updates `src/data/seed.json` and regenerates `supabase/seed/classified-inventory.sql` for the shared database.

## Team access

Anyone with the deployed app link can create an email/password account. A database trigger automatically inserts every new account into `public.team_members` as an active `bdc`; users cannot choose or promote their own role. Signed-out users still cannot read inventory or media.

- `owner` is the protected account that can manage team access and all inventory.
- `admin` can add, edit, mark sold, relist, delete, upload media, and generate AI descriptions.
- `bdc` sees the same inventory, photos, videos, CARFAX links, sold list, search, and filters with no editing access.

The owner-only **Admin access** panel lists signups, promotes BDC users to Admin, and disables or restores access. It can also pre-add a BDC email before registration. The owner cannot be demoted or disabled from the web app.

## Deploy

`netlify.toml` builds the Vite app with Node 22 and applies the SPA redirect and security headers. Add the two public Supabase variables to Netlify, then deploy `dist` with the Netlify CLI or connect the GitHub repository.
