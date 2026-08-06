import { createClient } from "@supabase/supabase-js";
import type { Context } from "@netlify/functions";

const SUPABASE_URL = "https://uduartuijwldxhgpmwks.supabase.co";
const BUCKET = "vehicle-media";
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const CONCURRENCY = 4;

type TrelloPreview = {
  url?: string;
  width?: number;
};

type TrelloAttachment = {
  id: string;
  name?: string;
  mimeType?: string;
  url: string;
  isUpload?: boolean;
  previews?: TrelloPreview[];
};

type TrelloCard = {
  idAttachmentCover?: string | null;
  attachments?: TrelloAttachment[];
};

type MediaRow = {
  id: number;
  source_url: string;
  storage_path: string | null;
  sort_order: number;
};

function cardReference(trelloUrl: string) {
  try {
    const url = new URL(trelloUrl);
    const match = url.pathname.match(/^\/c\/([^/]+)/);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function attachmentIdFromUrl(sourceUrl: string) {
  return sourceUrl.match(/\/attachments\/([a-f0-9]{24})(?:\/|$)/i)?.[1] || "";
}

function sourceFor(attachment: TrelloAttachment) {
  const previews = [...(attachment.previews || [])]
    .filter((preview) => preview.url && Number(preview.width) <= 1600)
    .sort((left, right) => Number(right.width) - Number(left.width));
  return previews[0]?.url || attachment.url;
}

function extensionFor(contentType: string, sourceUrl: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("jpeg")) return "jpg";
  const sourceExtension = new URL(sourceUrl).pathname.split(".").pop()?.toLowerCase();
  return sourceExtension && /^[a-z0-9]{2,5}$/.test(sourceExtension) ? sourceExtension : "jpg";
}

export default async (request: Request, _context: Context) => {
  if (request.method !== "POST") return;

  const trelloKey = Netlify.env.get("TRELLO_API_KEY");
  const trelloToken = Netlify.env.get("TRELLO_API_TOKEN");
  const publishableKey = Netlify.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    || request.headers.get("x-supabase-publishable-key");
  const authorization = request.headers.get("authorization") || "";
  const sessionToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!trelloKey || !trelloToken || !publishableKey || !sessionToken) {
    console.error("Full gallery sync is missing its authentication configuration.");
    return;
  }

  let input: { vehicleId?: unknown };
  try {
    input = await request.json();
  } catch {
    console.error("Full gallery sync received an invalid request body.");
    return;
  }
  const vehicleId = typeof input.vehicleId === "string" ? input.vehicleId.trim() : "";
  if (!vehicleId || vehicleId.length > 100) {
    console.error("Full gallery sync received an invalid vehicle id.");
    return;
  }

  const userClient = createClient(SUPABASE_URL, publishableKey, {
    global: { headers: { Authorization: `Bearer ${sessionToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(sessionToken);
  if (userError || !userData.user?.email) {
    console.error("Full gallery sync request did not contain a valid session.");
    return;
  }
  const { data: membership } = await userClient
    .from("team_members")
    .select("role, active")
    .eq("email", userData.user.email.toLowerCase())
    .eq("active", true)
    .maybeSingle();
  if (membership?.role !== "owner") {
    console.error("Only the inventory owner can sync a full Trello gallery.");
    return;
  }

  const { data: car, error: carError } = await userClient
    .from("cars")
    .select("id, trello_url")
    .eq("id", vehicleId)
    .maybeSingle();
  const cardId = cardReference(car?.trello_url || "");
  if (carError || !car || !cardId) {
    console.error(`Full gallery sync could not find a Trello card for vehicle ${vehicleId}.`);
    return;
  }

  const cardUrl = new URL(`https://api.trello.com/1/cards/${encodeURIComponent(cardId)}`);
  cardUrl.searchParams.set("fields", "idAttachmentCover");
  cardUrl.searchParams.set("attachments", "true");
  cardUrl.searchParams.set("attachment_fields", "id,name,mimeType,url,isUpload,previews");
  cardUrl.searchParams.set("key", trelloKey);
  cardUrl.searchParams.set("token", trelloToken);
  const cardResponse = await fetch(cardUrl);
  if (!cardResponse.ok) {
    console.error(`Trello returned HTTP ${cardResponse.status} while syncing vehicle ${vehicleId}.`);
    return;
  }
  const card = await cardResponse.json() as TrelloCard;
  const images = (card.attachments || []).filter((attachment) =>
    attachment.isUpload !== false
    && (attachment.mimeType || "").startsWith("image/")
    && Boolean(attachment.url),
  );
  const cover = images.find((attachment) => attachment.id === card.idAttachmentCover);
  const orderedImages = cover
    ? [cover, ...images.filter((attachment) => attachment.id !== cover.id)]
    : images;

  const { data: existingData, error: existingError } = await userClient
    .from("vehicle_media")
    .select("id, source_url, storage_path, sort_order")
    .eq("vehicle_id", vehicleId)
    .eq("kind", "image")
    .order("sort_order");
  if (existingError) {
    console.error(`Full gallery sync could not load existing media: ${existingError.message}`);
    return;
  }
  const existing = (existingData || []) as MediaRow[];
  const existingByAttachment = new Map(existing
    .map((item) => [attachmentIdFromUrl(item.source_url), item] as const)
    .filter(([attachmentId]) => Boolean(attachmentId)));
  const { data: storedFiles, error: storedFilesError } = await userClient.storage
    .from(BUCKET)
    .list(vehicleId, { limit: 1000 });
  if (storedFilesError) {
    console.error(`Full gallery sync could not verify stored files: ${storedFilesError.message}`);
    return;
  }
  const storedPaths = new Set((storedFiles || []).map((file) => `${vehicleId}/${file.name}`));
  const existingAttachmentIds = new Set([...existingByAttachment.entries()]
    .filter(([, item]) => item.storage_path && storedPaths.has(item.storage_path))
    .map(([attachmentId]) => attachmentId));
  const occupiedSortOrders = new Set(existing.map((item) => item.sort_order));
  const trelloAuthorization = `OAuth oauth_consumer_key="${trelloKey}", oauth_token="${trelloToken}"`;
  let inserted = 0;
  let failed = 0;

  const syncOne = async (attachment: TrelloAttachment, sourceIndex: number) => {
    if (existingAttachmentIds.has(attachment.id)) return;
    const existingRow = existingByAttachment.get(attachment.id);
    let sortOrder = existingRow?.sort_order ?? sourceIndex;
    while (!existingRow && occupiedSortOrders.has(sortOrder)) sortOrder += orderedImages.length;
    occupiedSortOrders.add(sortOrder);
    const sourceUrl = sourceFor(attachment);
    let storagePath = "";
    try {
      const mediaResponse = await fetch(sourceUrl, {
        headers: { Authorization: trelloAuthorization },
      });
      if (!mediaResponse.ok) throw new Error(`Trello media returned HTTP ${mediaResponse.status}`);
      const contentType = mediaResponse.headers.get("content-type") || attachment.mimeType || "image/jpeg";
      if (!contentType.startsWith("image/")) throw new Error(`Unsupported content type ${contentType}`);
      const bytes = new Uint8Array(await mediaResponse.arrayBuffer());
      if (!bytes.byteLength || bytes.byteLength > MAX_FILE_BYTES) {
        throw new Error(`Image size ${bytes.byteLength} is outside the allowed range`);
      }
      const extension = extensionFor(contentType, sourceUrl);
      storagePath = existingRow?.storage_path
        || `${vehicleId}/${String(sortOrder).padStart(3, "0")}-trello-${attachment.id}.${extension}`;
      const { error: uploadError } = await userClient.storage
        .from(BUCKET)
        .upload(storagePath, bytes, {
          contentType,
          upsert: Boolean(existingRow),
          cacheControl: "31536000",
        });
      if (uploadError) throw uploadError;

      const mediaValues = {
        vehicle_id: vehicleId,
        kind: "image",
        source_url: sourceUrl,
        storage_path: storagePath,
        sort_order: sortOrder,
        mime_type: contentType,
        migration_attempted_at: new Date().toISOString(),
        migration_error: null,
      };
      const { error: insertError } = existingRow
        ? await userClient.from("vehicle_media").update(mediaValues).eq("id", existingRow.id)
        : await userClient.from("vehicle_media").insert(mediaValues);
      if (insertError) {
        if (!existingRow) await userClient.storage.from(BUCKET).remove([storagePath]);
        throw insertError;
      }
      existingAttachmentIds.add(attachment.id);
      inserted += 1;
    } catch (error) {
      failed += 1;
      if (storagePath && !existingRow) await userClient.storage.from(BUCKET).remove([storagePath]);
      const message = error instanceof Error ? error.message : "Unknown sync error";
      console.warn(`Trello attachment ${attachment.id} could not be synced: ${message}`);
    }
  };

  const missing = orderedImages
    .map((attachment, index) => ({ attachment, index }))
    .filter(({ attachment }) => !existingAttachmentIds.has(attachment.id));
  for (let index = 0; index < missing.length; index += CONCURRENCY) {
    await Promise.all(missing.slice(index, index + CONCURRENCY).map(({ attachment, index: sourceIndex }) =>
      syncOne(attachment, sourceIndex),
    ));
  }

    const { error: updateError } = await userClient
    .from("cars")
    .update({ photo_count: orderedImages.length })
    .eq("id", vehicleId);
  if (updateError) console.warn(`Photo count could not be updated: ${updateError.message}`);

  console.log(JSON.stringify({
    vehicleId,
    discovered: orderedImages.length,
    existing: existing.length,
    inserted,
    failed,
  }));
};
