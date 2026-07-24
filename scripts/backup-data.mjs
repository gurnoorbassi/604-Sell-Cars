import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running a backup.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const backupDirectory = resolve(process.argv[2] || `backups/${new Date().toISOString().replace(/[:.]/g, "-")}`);
await mkdir(backupDirectory, { recursive: true });

for (const table of ["cars", "vehicle_media", "leads", "team_members", "inventory_audit"]) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  await writeFile(resolve(backupDirectory, `${table}.json`), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  console.log(`${table}: ${rows.length} rows`);
}

console.log(`Backup written to ${backupDirectory}`);
