import { createClient } from "@supabase/supabase-js";

const required = [
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TRELLO_API_KEY",
  "TRELLO_API_TOKEN",
];
const missingEnvironment = required.filter((key) => !process.env[key]);
if (missingEnvironment.length) {
  console.error(`Missing environment variables: ${missingEnvironment.join(", ")}`);
  process.exit(1);
}

const shouldWrite = process.argv.includes("--write");
const bucket = "vehicle-media";
const maxFileBytes = 50 * 1024 * 1024;
const cardBatchSize = 25;
const cardBatchPauseMs = 3_000;
const uploadConcurrency = 3;
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function cardReference(trelloUrl = "") {
  try {
    return new URL(trelloUrl).pathname.match(/^\/c\/([^/]+)/)?.[1] || "";
  } catch {
    return "";
  }
}

function attachmentIdFromUrl(sourceUrl = "") {
  return sourceUrl.match(/\/attachments\/([a-f0-9]{24})(?:\/|$)/i)?.[1] || "";
}

function sourceFor(attachment) {
  const previews = [...(attachment.previews || [])]
    .filter((preview) => preview.url && Number(preview.width) <= 1600)
    .sort((left, right) => Number(right.width) - Number(left.width));
  return previews[0]?.url || attachment.url;
}

function extensionFor(contentType, sourceUrl) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  try {
    const sourceExtension = new URL(sourceUrl).pathname.split(".").pop()?.toLowerCase();
    if (sourceExtension && /^[a-z0-9]{2,5}$/.test(sourceExtension)) return sourceExtension;
  } catch {
    // Use the safe image default below.
  }
  return "jpg";
}

async function loadAllRows(table, columns, orderColumn) {
  const rows = [];
  const pageSize = 1_000;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(orderColumn)
      .range(start, start + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function fetchTrelloCard(car) {
  const cardId = cardReference(car.trello_url);
  if (!cardId) return { car, error: "Invalid Trello card URL", images: [] };

  const url = new URL(`https://api.trello.com/1/cards/${encodeURIComponent(cardId)}`);
  url.searchParams.set("fields", "idAttachmentCover");
  url.searchParams.set("attachments", "true");
  url.searchParams.set("attachment_fields", "id,name,mimeType,url,isUpload,previews");
  url.searchParams.set("key", process.env.TRELLO_API_KEY);
  url.searchParams.set("token", process.env.TRELLO_API_TOKEN);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Trello HTTP ${response.status}`);
    const card = await response.json();
    const images = (card.attachments || []).filter((attachment) =>
      attachment.isUpload !== false
      && (attachment.mimeType || "").startsWith("image/")
      && Boolean(attachment.url),
    );
    const cover = images.find((attachment) => attachment.id === card.idAttachmentCover);
    return {
      car,
      error: "",
      images: cover
        ? [cover, ...images.filter((attachment) => attachment.id !== cover.id)]
        : images,
    };
  } catch (error) {
    return {
      car,
      error: error instanceof Error ? error.message : "Unknown Trello error",
      images: [],
    };
  }
}

async function mapInBatches(items, batchSize, operation, pauseMs = 0) {
  const results = [];
  for (let index = 0; index < items.length; index += batchSize) {
    results.push(...await Promise.all(items.slice(index, index + batchSize).map(operation)));
    if (pauseMs && index + batchSize < items.length) await pause(pauseMs);
  }
  return results;
}

const cars = await loadAllRows("cars", "id,title,trello_url,photo_count", "id");
const media = await loadAllRows(
  "vehicle_media",
  "id,vehicle_id,kind,source_url,storage_path,sort_order",
  "id",
);
const imageMediaByCar = new Map();
for (const item of media) {
  if (item.kind !== "image") continue;
  const group = imageMediaByCar.get(item.vehicle_id) || [];
  group.push(item);
  imageMediaByCar.set(item.vehicle_id, group);
}

console.log(`Checking ${cars.length} Trello cards against ${media.length} board media rows...`);
const cardResults = await mapInBatches(
  cars.filter((car) => cardReference(car.trello_url)),
  cardBatchSize,
  fetchTrelloCard,
  cardBatchPauseMs,
);

const missingPhotos = [];
const countUpdates = [];
const cardErrors = [];
for (const result of cardResults) {
  if (result.error) {
    cardErrors.push({ id: result.car.id, title: result.car.title, error: result.error });
    continue;
  }

  const existing = imageMediaByCar.get(result.car.id) || [];
  const existingAttachmentIds = new Set(
    existing.map((item) => attachmentIdFromUrl(item.source_url)).filter(Boolean),
  );
  const occupiedSortOrders = new Set(existing.map((item) => item.sort_order));

  result.images.forEach((attachment, sourceIndex) => {
    if (existingAttachmentIds.has(attachment.id)) return;
    let sortOrder = sourceIndex;
    while (occupiedSortOrders.has(sortOrder)) sortOrder += result.images.length || 1;
    occupiedSortOrders.add(sortOrder);
    missingPhotos.push({ car: result.car, attachment, sourceIndex, sortOrder });
  });

  if (Number(result.car.photo_count) !== result.images.length) {
    countUpdates.push({
      id: result.car.id,
      title: result.car.title,
      before: Number(result.car.photo_count) || 0,
      after: result.images.length,
    });
  }
}

const affectedCars = new Set(missingPhotos.map((item) => item.car.id));
console.log(JSON.stringify({
  mode: shouldWrite ? "write" : "audit",
  checkedCars: cardResults.length,
  cardErrors: cardErrors.length,
  missingPhotos: missingPhotos.length,
  affectedCars: affectedCars.size,
  countUpdates: countUpdates.length,
}, null, 2));

for (const update of countUpdates) {
  console.log(`Count ${update.id}: ${update.before} -> ${update.after} | ${update.title}`);
}
for (const item of missingPhotos) {
  console.log(`Missing ${item.attachment.id} | ${item.car.id} | ${item.car.title}`);
}
for (const item of cardErrors) {
  console.warn(`Card error ${item.id}: ${item.error} | ${item.title}`);
}

if (!shouldWrite) {
  console.log("Audit complete. Run again with --write to copy the missing Trello photos.");
  process.exit(cardErrors.length ? 2 : 0);
}

const trelloAuthorization = `OAuth oauth_consumer_key="${process.env.TRELLO_API_KEY}", oauth_token="${process.env.TRELLO_API_TOKEN}"`;
let inserted = 0;
let failed = 0;

async function syncPhoto(item) {
  const sourceUrl = sourceFor(item.attachment);
  let storagePath = "";
  try {
    const response = await fetch(sourceUrl, {
      headers: { Authorization: trelloAuthorization },
    });
    if (!response.ok) throw new Error(`Trello media HTTP ${response.status}`);
    const contentType = response.headers.get("content-type")
      || item.attachment.mimeType
      || "image/jpeg";
    if (!contentType.startsWith("image/")) throw new Error(`Unsupported content type ${contentType}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > maxFileBytes) {
      throw new Error(`Image size ${bytes.byteLength} is outside the allowed range`);
    }

    const extension = extensionFor(contentType, sourceUrl);
    storagePath = `${item.car.id}/${String(item.sortOrder).padStart(3, "0")}-trello-${item.attachment.id}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, bytes, {
        contentType,
        upsert: false,
        cacheControl: "31536000",
      });
    if (uploadError) throw uploadError;

    const { error: insertError } = await supabase.from("vehicle_media").insert({
      vehicle_id: item.car.id,
      kind: "image",
      source_url: sourceUrl,
      storage_path: storagePath,
      sort_order: item.sortOrder,
      mime_type: contentType,
      migration_attempted_at: new Date().toISOString(),
      migration_error: null,
    });
    if (insertError) {
      await supabase.storage.from(bucket).remove([storagePath]);
      throw insertError;
    }
    inserted += 1;
  } catch (error) {
    failed += 1;
    if (storagePath) await supabase.storage.from(bucket).remove([storagePath]);
    const message = error instanceof Error ? error.message : "Unknown sync error";
    console.warn(`Failed ${item.attachment.id} for ${item.car.id}: ${message}`);
  }
}

await mapInBatches(missingPhotos, uploadConcurrency, syncPhoto, 100);

for (const update of countUpdates) {
  const { error } = await supabase
    .from("cars")
    .update({ photo_count: update.after })
    .eq("id", update.id);
  if (error) console.warn(`Could not update photo count for ${update.id}: ${error.message}`);
}

console.log(JSON.stringify({
  inserted,
  failed,
  cardErrors: cardErrors.length,
  updatedPhotoCounts: countUpdates.length,
}, null, 2));
if (failed || cardErrors.length) process.exitCode = 2;
