# Production operations

The active deployment target is the self-hosted Ubuntu VPS described in `README.md`. Netlify and hosted Supabase files are retained only for migration history.

## Health

```bash
curl https://YOUR_DOMAIN/health
pm2 status
pm2 logs 604-sell-cars --lines 100
sudo tail -n 100 /var/log/nginx/error.log
```

## Backups

Back up both PostgreSQL and VPS media:

```bash
pg_dump "$DATABASE_URL" -Fc > sellcars-$(date +%F).dump
tar -czf sellcars-media-$(date +%F).tar.gz -C /var/lib/604-sell-cars uploads
```

Encrypt backups and store them outside the VPS. Run a restore drill quarterly.

## Deployment

```bash
cd ~/604-Sell-Cars
git pull --ff-only
npm ci
npm run migrate
npm run build
npm test
pm2 reload ecosystem.config.cjs --update-env
curl http://127.0.0.1:3000/health
```

## Lead and reminder checks

```sql
select id, name, phone, car_id, appointment_time, appointment_status,
       reminder_24h_sent_at, reminder_2h_sent_at
from leads
order by created_at desc;
```

Cancelled and passed appointments are never selected by the reminder job.

## Media

New uploads are stored under `UPLOAD_DIR`. Keep that directory writable by the PM2 user and inaccessible except through the application/Nginx path.

```bash
du -sh /var/lib/604-sell-cars/uploads
find /var/lib/604-sell-cars/uploads -type f | wc -l
```
