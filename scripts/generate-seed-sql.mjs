import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const seed = JSON.parse(await readFile(resolve(import.meta.dirname, "../src/data/seed.json"), "utf8"));
const encode = (value) => Buffer.from(JSON.stringify(value), "utf8").toString("base64");
const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
  items.slice(index * size, (index + 1) * size),
);

const inventoryRows = seed.map((record) => ({
  id: record.id,
  title: record.t,
  stock: record.sk || "",
  price: record.p || "",
  kms: record.k || "",
  dealership: record.d || "",
  body_type: record.b || "",
  fuel_tags: record.f || [],
  labels: record.l || [],
  description: record.de || "",
  carfax_url: record.carfax || "",
  trello_url: record.trelloUrl || "",
  photo_count: record.pc || 0,
  hot: !!record.h,
  is_new: !!record.n,
  status: record.s ? "sold" : "live",
}));

const mediaRows = seed.flatMap((record) => [
  ...(record.photos || []).map((source_url, sort_order) => ({
    vehicle_id: record.id, kind: "image", source_url, sort_order, mime_type: "image/webp",
  })),
  ...(record.videos || []).map((source_url, index) => ({
    vehicle_id: record.id, kind: "video", source_url,
    sort_order: (record.photos || []).length + index, mime_type: null,
  })),
]);

const queries = [];
const inventoryBatches = chunks(inventoryRows, 10);
for (const batch of inventoryBatches) {
  queries.push(`
with payload as (
  select convert_from(decode('${encode(batch)}', 'base64'), 'UTF8')::jsonb as data
), rows as (
  select x.* from payload, jsonb_to_recordset(payload.data) as x(
    id text, title text, stock text, price text, kms text, dealership text,
    body_type text, fuel_tags text[], labels text[], description text,
    carfax_url text, trello_url text, photo_count integer, hot boolean,
    is_new boolean, status text
  )
)
insert into public.inventory (
  id, title, stock, price, kms, dealership, body_type, fuel_tags, labels,
  description, carfax_url, trello_url, photo_count, hot, is_new, status
)
select id, title, stock, price, kms, dealership, body_type, fuel_tags, labels,
  description, carfax_url, trello_url, photo_count, hot, is_new, status
from rows
on conflict (id) do update set
  title = excluded.title, stock = excluded.stock, price = excluded.price,
  kms = excluded.kms, dealership = excluded.dealership, body_type = excluded.body_type,
  fuel_tags = excluded.fuel_tags, labels = excluded.labels, description = excluded.description,
  carfax_url = excluded.carfax_url, trello_url = excluded.trello_url,
  photo_count = excluded.photo_count, hot = excluded.hot, is_new = excluded.is_new,
  status = excluded.status, updated_at = now();`);
}

for (const batch of chunks(mediaRows, 50)) {
  queries.push(`
with payload as (
  select convert_from(decode('${encode(batch)}', 'base64'), 'UTF8')::jsonb as data
), rows as (
  select x.* from payload, jsonb_to_recordset(payload.data) as x(
    vehicle_id text, kind text, source_url text, sort_order integer, mime_type text
  )
)
insert into public.vehicle_media (vehicle_id, kind, source_url, sort_order, mime_type)
select vehicle_id, kind, source_url, sort_order, mime_type from rows
on conflict (vehicle_id, kind, sort_order) do update set
  source_url = excluded.source_url,
  mime_type = excluded.mime_type;`);
}

if (process.argv.includes("--inventory-count")) {
  process.stdout.write(String(inventoryBatches.length));
} else if (process.argv.includes("--count")) {
  process.stdout.write(String(queries.length));
} else {
  const batchFlag = process.argv.indexOf("--batch");
  if (batchFlag >= 0) {
    const batchIndex = Number(process.argv[batchFlag + 1]);
    if (!Number.isInteger(batchIndex) || !queries[batchIndex]) throw new Error("Invalid seed batch index.");
    process.stdout.write(queries[batchIndex]);
  } else {
    process.stdout.write(JSON.stringify(queries));
  }
}
