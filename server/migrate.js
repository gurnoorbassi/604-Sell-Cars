import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./db.js";
import { validateConfig } from "./config.js";

validateConfig();
const migrationDir = path.resolve("supabase", "migrations");
await pool.query(`create table if not exists app_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
)`);
const applied = new Set((await pool.query("select name from app_migrations")).rows.map((row) => row.name));
for (const name of (await readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort()) {
  if (applied.has(name)) continue;
  // The earlier migrations depend on hosted Supabase auth/storage. The unified
  // migration is the portable VPS baseline for an exported existing database.
  if (!name.includes("unify_cars_and_leads")) continue;
  const sql = await readFile(path.join(migrationDir, name), "utf8");
  await pool.query(sql);
  await pool.query("insert into app_migrations (name) values ($1)", [name]);
  console.log(`Applied ${name}`);
}
await pool.end();
