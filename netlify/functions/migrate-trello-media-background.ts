import { createClient } from "@supabase/supabase-js";
import type { Context } from "@netlify/functions";

const SUPABASE_URL = "https://uduartuijwldxhgpmwks.supabase.co";
const BUCKET = "vehicle-media";
const MAX_FREE_FILE_BYTES = 50 * 1024 * 1024;
const BATCH_SIZE = 100;
const CONCURRENCY = 6;
const MAX_RUNTIME_MS = 13 * 60 * 1000;

type MediaRow = {
  id: number;
  vehicle_id: string;
  kind: "image" | "video";
  source_url: string;
  sort_order: number;
  mime_type: string | null;
};

function extensionFor(contentType: string, sourceUrl: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("mp4")) return "mp4";
  const sourceExtension = new URL(sourceUrl).pathname.split(".").pop()?.toLowerCase();
  return sourceExtension && /^[a-z0-9]{2,5}$/.test(sourceExtension) ? sourceExtension : "bin";
}

export default async (request: Request, _context: Context) => {
  if (request.method !== "POST") return;

  const apiKey = Netlify.env.get("TRELLO_API_KEY");
  const apiToken = Netlify.env.get("TRELLO_API_TOKEN");
  const publishableKey = Netlify.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    || request.headers.get("x-supabase-publishable-key");
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!apiKey || !apiToken || !publishableKey || !token) {
    console.error("Media migration is missing its authentication configuration.");
    return;
  }

  const supabase = createClient(SUPABASE_URL, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user?.email) {
    console.error("Media migration request did not contain a valid session.");
    return;
  }
  const { data: membership } = await supabase
    .from("team_members")
    .select("role, active")
    .eq("email", userData.user.email.toLowerCase())
    .eq("active", true)
    .maybeSingle();
  if (membership?.role !== "owner") {
    console.error("Only the inventory owner can start the Trello media migration.");
    return;
  }

  const trelloAuthorization = `OAuth oauth_consumer_key="${apiKey}", oauth_token="${apiToken}"`;
  const startedAt = Date.now();
  let migrated = 0;
  let failed = 0;

  const migrateOne = async (item: MediaRow) => {
    try {
      const upstream = await fetch(item.source_url, {
        headers: { Authorization: trelloAuthorization },
      });
      if (!upstream.ok) throw new Error(`Trello returned HTTP ${upstream.status}`);
      const contentType = upstream.headers.get("content-type") || item.mime_type || "application/octet-stream";
      if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
        throw new Error(`Unsupported content type ${contentType}`);
      }
      const declaredSize = Number(upstream.headers.get("content-length") || 0);
      if (declaredSize > MAX_FREE_FILE_BYTES) {
        throw new Error(`File is ${Math.ceil(declaredSize / 1024 / 1024)} MB; Supabase Free allows 50 MB`);
      }
      const bytes = new Uint8Array(await upstream.arrayBuffer());
      if (bytes.byteLength > MAX_FREE_FILE_BYTES) {
        throw new Error(`File is ${Math.ceil(bytes.byteLength / 1024 / 1024)} MB; Supabase Free allows 50 MB`);
      }

      const extension = extensionFor(contentType, item.source_url);
      const storagePath = `${item.vehicle_id}/${String(item.sort_order).padStart(3, "0")}-${item.id}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
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
        await supabase.storage.from(BUCKET).remove([storagePath]);
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
      console.warn(`Media ${item.id} could not be migrated: ${message}`);
    }
  };

  while (Date.now() - startedAt < MAX_RUNTIME_MS) {
    const { data, error } = await supabase
      .from("vehicle_media")
      .select("id, vehicle_id, kind, source_url, sort_order, mime_type")
      .is("storage_path", null)
      .is("migration_error", null)
      .neq("source_url", "")
      .order("id")
      .limit(BATCH_SIZE);
    if (error) {
      console.error(`Could not load the next media migration batch: ${error.message}`);
      break;
    }
    if (!data?.length) break;

    for (let index = 0; index < data.length; index += CONCURRENCY) {
      await Promise.all((data.slice(index, index + CONCURRENCY) as MediaRow[]).map(migrateOne));
    }
  }

  console.log(JSON.stringify({ migrated, failed, durationMs: Date.now() - startedAt }));
};
