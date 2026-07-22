import { createClient } from "@supabase/supabase-js";

const required = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_MIGRATION_EMAIL",
  "SUPABASE_MIGRATION_PASSWORD",
  "TRELLO_API_KEY",
  "TRELLO_API_TOKEN",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: true } },
);
const { error: signInError } = await supabase.auth.signInWithPassword({
  email: process.env.SUPABASE_MIGRATION_EMAIL,
  password: process.env.SUPABASE_MIGRATION_PASSWORD,
});
if (signInError) throw signInError;

const trelloAuthorization = `OAuth oauth_consumer_key="${process.env.TRELLO_API_KEY}", oauth_token="${process.env.TRELLO_API_TOKEN}"`;
const pageSize = 250;
let migrated = 0;
let failed = 0;

async function migrate(item) {
  try {
    const response = await fetch(item.source_url, { headers: { Authorization: trelloAuthorization } });
    if (!response.ok) throw new Error(`Trello HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || item.mime_type || "image/webp";
    const extension = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : "webp";
    const storagePath = `${item.vehicle_id}/${String(item.sort_order).padStart(3, "0")}-${item.id}.${extension}`;
    const bytes = Buffer.from(await response.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from("vehicle-media")
      .upload(storagePath, bytes, { contentType, upsert: true });
    if (uploadError) throw uploadError;
    const { error: updateError } = await supabase.from("vehicle_media")
      .update({ storage_path: storagePath, mime_type: contentType })
      .eq("id", item.id);
    if (updateError) throw updateError;
    migrated += 1;
  } catch (error) {
    failed += 1;
    console.warn(`Failed media ${item.id} (${item.vehicle_id}): ${error.message}`);
  }
}

while (true) {
  const { data, error } = await supabase.from("vehicle_media")
    .select("id,vehicle_id,source_url,sort_order,mime_type")
    .eq("kind", "image")
    .is("storage_path", null)
    .neq("source_url", "")
    .order("id")
    .limit(pageSize);
  if (error) throw error;
  if (!data.length) break;

  const migratedBeforePage = migrated;
  for (let index = 0; index < data.length; index += 4) {
    await Promise.all(data.slice(index, index + 4).map(migrate));
  }
  console.log(`Migrated ${migrated}; failed ${failed}; checking remaining files…`);
  if (migrated === migratedBeforePage) {
    console.warn("No files in this batch could be migrated; stopping to avoid retrying forever.");
    break;
  }
}

await supabase.auth.signOut();
console.log(`Migration complete. Migrated ${migrated}; failed ${failed}.`);
if (failed) process.exitCode = 2;
