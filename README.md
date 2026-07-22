# Dealership Inventory Board

A local-first React inventory board built from the supplied 531-car Trello export.

## What works

- All 531 imported records live in `src/data/seed.json`.
- Inventory changes persist in browser `localStorage`; no Claude artifact API is required.
- CARFAX URLs are clickable when an actual URL exists.
- Live/sold status, filters, search, editing, and new inventory all persist locally.
- A Trello importer can retrieve authorized photo/video attachments and CARFAX links.

## Run locally

```powershell
npm install
npm run dev
```

## Import Trello media

Being signed in to Trello in a browser does not automatically authenticate a Node script. Create a read-only Trello API token, copy `.env.example` to `.env`, and set:

```text
TRELLO_API_KEY=your_api_key
TRELLO_API_TOKEN=your_read_only_token
TRELLO_BOARD_ID=the_board_id_or_shortlink
```

Then load the variables in your shell and run:

```powershell
$env:TRELLO_API_KEY = "..."
$env:TRELLO_API_TOKEN = "..."
$env:TRELLO_BOARD_ID = "..."
npm run import:trello
```

The importer downloads authorized images and videos to `public/media`, links matched records to their Trello cards, and writes recovered CARFAX URLs back into the seed. Never commit `.env` or a Trello token. Review the media folder size before committing; for a large library, upload it to Supabase Storage and store those public or signed URLs instead.

## Storage scope

`localStorage` is per browser and device. Team logins, shared edits, audit history, and durable media should move to a backend such as Supabase.
