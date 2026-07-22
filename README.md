# Dealership Inventory Board

A shared React inventory web app built from the supplied Trello export. The original compact seed contained 531 rows; 187 were duplicate URL-only pointers, leaving 344 unique vehicle records.

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

This matches vehicles by their original Trello card IDs, removes duplicate URL-only pointers, restores card names and descriptions, adds up to eight 600px previews per vehicle, and recovers CARFAX links.

## Run locally

```powershell
npm install
npm run dev
```

The app requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in an ignored `.env` file. Copy `.env.example` and fill those values before starting it.

## Migrate Trello media to Supabase

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

The older `npm run import:trello` command is still available when you need a fresh API import directly from a board.

## Team access

Team access is allowlisted in `public.team_members`. Add an email there before that person signs up. Row-level security denies inventory and media access to signed-out or unapproved users.

## Deploy

`netlify.toml` builds the Vite app with Node 22 and applies the SPA redirect and security headers. Add the two public Supabase variables to Netlify, then deploy `dist` with the Netlify CLI or connect the GitHub repository.
