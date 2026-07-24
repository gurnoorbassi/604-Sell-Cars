# 604 Sell Cars

One self-hosted system for the 604 Sell Cars inventory board, public vehicle website, paid-ad landing page, appointment scheduling, lead operations, Twilio follow-up, and VPS media library.

The existing React inventory board has been retained as the frontend foundation. The production runtime is now:

- React 19, Vite, and Tailwind CSS
- Node.js 20+ and Express 5
- One PostgreSQL database
- VPS filesystem media with Sharp compression and thumbnails
- Twilio as the only external runtime service
- PM2 behind Nginx with SSL

Supabase and Netlify files remain only as migration history. They are not required by the self-hosted runtime.

## Routes

- `/site` — public homepage and featured inventory
- `/site/inventory` — URL-filtered, shareable inventory search
- `/site/cars/:id` — vehicle gallery, specs, CARFAX, SEO data, and booking
- `/landing` — mobile paid-ad lead capture and self-scheduling
- `/admin` — password-protected lead desk and inventory/media editor
- `/health` — runtime health response

## Data rules

- The previous `inventory` table is renamed to `cars`; no duplicate inventory table is created.
- `cars` is the source for the internal board, public website, and booking form.
- Legacy rows without verified location data are explicitly marked `LOCATION_REQUIRED` or `ADDRESS REQUIRED` and remain hidden publicly.
- New and edited vehicles require lot code, lot name, and full street address.
- Marking a car `sold` removes it from the public APIs immediately.
- Phone numbers are normalized and unique. A repeated phone updates the same lead.
- PostgreSQL advisory locks prevent two different people from booking the same lot and time.
- Appointment location is always derived from the chosen car.

## Environment configuration

Copy `.env.example` to `.env`:

```dotenv
DATABASE_URL=postgresql://sellcars_app:YOUR_PASSWORD@127.0.0.1:5432/sellcars
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
ADMIN_NOTIFY_NUMBER=
ADMIN_PASSWORD=CREATE_YOUR_OWN_LONG_PASSWORD
META_PIXEL_ID=
PORT=3000
APP_TIMEZONE=America/Vancouver
NODE_ENV=development
UPLOAD_DIR=uploads
```

You create both the PostgreSQL password and `ADMIN_PASSWORD`; they are not third-party credentials. Twilio values can remain blank until real SMS delivery is needed. `META_PIXEL_ID` can remain blank until ads are configured.

Never commit `.env`.

## Work without credentials

The project can be installed, tested, built, reviewed, and browser-previewed without real credentials:

```powershell
npm install
npm test
npm run build
```

A real running application requires PostgreSQL and a locally chosen admin password. Twilio is optional during development; SMS calls are skipped when it is unconfigured.

## Local PostgreSQL setup

Install PostgreSQL 15 or newer and create an application role:

```sql
CREATE USER sellcars_app WITH PASSWORD 'choose-a-long-local-password';
CREATE DATABASE sellcars OWNER sellcars_app;
```

Set `DATABASE_URL`, then:

```powershell
npm run migrate
npm run import:seed
npm run dev
```

The web frontend runs through Vite and proxies API requests to Express. Correct the flagged lot addresses in `/admin?view=inventory` before expecting the imported cars to appear publicly.

## Existing inventory and media

`npm run import:seed` imports the repository’s 344 deduplicated Trello-derived vehicles into `cars`. It never invents street addresses. Imported rows remain private until an admin supplies the correct address.

To localize accessible Trello/external media onto the VPS after configuring the optional Trello migration credentials:

```powershell
npm run migrate:media:vps
```

Images are resized to a maximum width of 2200px, converted to WebP, and receive 520×350 thumbnails. Videos are copied into the car’s VPS media directory. Failed sources remain in the database for a later retry.

If the live hosted database contains newer changes than `src/data/seed.json`, export the `inventory`/`cars` and `vehicle_media` data before decommissioning it, then restore it into a temporary PostgreSQL database and run the unified migration. Do not shut down the old board until row counts and media have been reconciled.

## Tests and verification

```powershell
npm test
npm run check
npm run build
npm audit
```

Tests cover the original inventory helpers, phone normalization/upsert behavior, lot collision prevention, 14-day hourly scheduling, and Twilio message content.

## Ubuntu VPS deployment

These instructions target Ubuntu 24.04. Replace example values with your domain and repository.

### 1. Install the runtime

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl nginx postgresql postgresql-contrib
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 2. Create PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE USER sellcars_app WITH PASSWORD 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';
CREATE DATABASE sellcars OWNER sellcars_app;
\q
```

Keep port 5432 private.

### 3. Clone the private repository

Create a read-only GitHub deploy key:

```bash
ssh-keygen -t ed25519 -C "604-sell-cars-vps" -f ~/.ssh/604_sell_cars
cat ~/.ssh/604_sell_cars.pub
```

Add it under the GitHub repository’s **Settings → Deploy keys**, then configure SSH:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github-604
  HostName github.com
  User git
  IdentityFile ~/.ssh/604_sell_cars
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
git clone git@github-604:gurnoorbassi/604-Sell-Cars.git ~/604-Sell-Cars
cd ~/604-Sell-Cars
npm ci
```

### 4. Configure the server

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

Use:

```dotenv
DATABASE_URL=postgresql://sellcars_app:URL_ENCODED_PASSWORD@127.0.0.1:5432/sellcars
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
ADMIN_NOTIFY_NUMBER=
ADMIN_PASSWORD=YOUR_LONG_RANDOM_PASSWORD
META_PIXEL_ID=
PORT=3000
APP_TIMEZONE=America/Vancouver
NODE_ENV=production
UPLOAD_DIR=/var/lib/604-sell-cars/uploads
```

Create the upload directory:

```bash
sudo mkdir -p /var/lib/604-sell-cars/uploads
sudo chown -R "$USER":"$USER" /var/lib/604-sell-cars
```

### 5. Build and initialize

```bash
npm run migrate
npm run import:seed
npm run build
npm test
```

Enter correct lot addresses in admin before production launch. Then migrate media when ready:

```bash
npm run migrate:media:vps
```

### 6. Start with PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd
```

Run the command printed by `pm2 startup`, then:

```bash
pm2 save
curl http://127.0.0.1:3000/health
```

### 7. Configure Nginx

Create `/etc/nginx/sites-available/604-sell-cars`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name cars.example.com;

    client_max_body_size 260m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/604-sell-cars /etc/nginx/sites-enabled/604-sell-cars
sudo nginx -t
sudo systemctl reload nginx
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 8. Add SSL

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d cars.example.com
sudo certbot renew --dry-run
```

HTTPS is mandatory because `/admin` uses shared-password Basic Authentication.

### 9. Verify before launch

1. Open `/admin` over HTTPS.
2. Correct each lot’s real name and full street address.
3. Add or verify vehicle media.
4. Confirm sold cars disappear from `/site`.
5. Submit a booking using a phone you control.
6. Confirm the saved lead, correct lot confirmation, admin SMS, lead SMS, and reminder schedule.
7. Back up PostgreSQL and `/var/lib/604-sell-cars/uploads`.

After launch, set the GitHub repository variable `PRODUCTION_HEALTH_URL` to the full HTTPS health URL so the hourly uptime workflow monitors the VPS.

## Updating production

```bash
cd ~/604-Sell-Cars
git pull --ff-only
npm ci
npm run migrate
npm run build
pm2 reload ecosystem.config.cjs --update-env
curl http://127.0.0.1:3000/health
```

## Git

The repository is already private. Before any push:

```bash
git status
git diff --check
git add .
git commit -m "Build unified self-hosted 604 Sell Cars system"
git push -u origin codex/unified-604-sell-cars
```
