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
const pageSize = 100;
const concurrency = 6;
const maxFileBytes = 50 * 1024 * 1024;
let migrated = 0;
let failed = 0;

function extensionFor(contentType, sourceUrl) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("mp4")) return "mp4";
  const sourceExtension = new URL(sourceUrl).pathname.split(".").pop()?.toLowerCase();
  return sourceExtension && /^[a-z0-9]{2,5}$/.test(sourceExtension) ? sourceExtension : "bin";
}

async function migrate(item) {
  let storagePath = "";
  try {
    const response = await fetch(item.source_url, {
      headers: { Authorization: trelloAuthorization },
    });
    if (!response.ok) throw new Error(`Trello HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || item.mime_type || "application/octet-stream";
    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      throw new Error(`Unsupported content type ${contentType}`);
    }
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > maxFileBytes) {
      throw new Error(`File is ${Math.ceil(declaredSize / 1024 / 1024)} MB; Supabase Free allows 50 MB`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > maxFileBytes) {
      throw new Error(`File is ${Math.ceil(bytes.byteLength / 1024 / 1024)} MB; Supabase Free allows 50 MB`);
    }

    const extension = extensionFor(contentType, item.source_url);
    storagePath = `${item.vehicle_id}/${String(item.sort_order).padStart(3, "0")}-${item.id}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("vehicle-media")
      .upload(storagePath, bytes, { contentType, upsert: true, cacheControl: "31536000" });
    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
      .from("vehicle_media")
      .update({
        storage_path: storagePath,
        mime_type: contentType,
        migration_attempted_at: new Date().toISOString(),
        migration_error: null,
      })
      .eq("id", item.id);
    if (updateError) {
      await supabase.storage.from("vehicle-media").remove([storagePath]);
      throw updateError;
    }
    migrated += 1;
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : "Unknown migration error";
    await supabase
      .from("vehicle_media")
      .update({
        migration_attempted_at: new Date().toISOString(),
        migration_error: message.slice(0, 500),
      })
      .eq("id", item.id);
    console.warn(`Failed media ${item.id} (${item.vehicle_id}): ${message}`);
  }
}

while (true) {
  const { data, error } = await supabase
    .from("vehicle_media")
    .select("id,vehicle_id,kind,source_url,sort_order,mime_type")
    .is("storage_path", null)
    .is("migration_error", null)
    .neq("source_url", "")
    .order("id")
    .limit(pageSize);
  if (error) throw error;
  if (!data.length) break;

  const migratedBeforePage = migrated;
  for (let index = 0; index < data.length; index += concurrency) {
    await Promise.all(data.slice(index, index + concurrency).map(migrate));
  }
  console.log(`Migrated ${migrated}; failed ${failed}; checking remaining files...`);
  if (migrated === migratedBeforePage) {
    console.warn("No files in this batch could be migrated; stopping to avoid retrying forever.");
    break;
  }
}

await supabase.auth.signOut();
console.log(`Migration complete. Migrated ${migrated}; failed ${failed}.`);
if (failed) process.exitCode = 2;
