import { readFile } from "node:fs/promises";
import { pool } from "./db.js";
import { validateConfig } from "./config.js";

validateConfig();
const seed = JSON.parse(await readFile(new URL("../src/data/seed.json", import.meta.url), "utf8"));
const client = await pool.connect();

const slug = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const vehicleParts = (title) => {
  const match = String(title).match(/\b((?:19|20)\d{2})\s+([A-Za-z-]+)\s+([A-Za-z0-9-]+)/);
  return match ? { year: Number(match[1]), make: match[2], model: match[3] } : {};
};

try {
  await client.query("begin");
  for (const item of seed) {
    const parts = vehicleParts(item.t);
    const lotName = String(item.d || "").trim();
    const lot = slug(lotName) || "LOCATION_REQUIRED";
    await client.query(
      `insert into cars (
        id, title, price, kms, dealership, body_type, fuel_tags, labels, description,
        carfax_url, trello_url, photo_count, status, year, make, model, price_amount,
        mileage, lot, lot_name, lot_address, images, videos
       ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'available',$13,$14,$15,$16,$17,$18,$19,'ADDRESS REQUIRED',$20,$21
       )
       on conflict (id) do nothing`,
      [
        item.id, item.t, item.p || "", item.k || "", lotName, item.b || "",
        item.f || [], item.l || [], item.de || "", item.carfax || "", item.trelloUrl || "",
        Number(item.pc) || (item.photos || []).length, parts.year || null, parts.make || null,
        parts.model || null, Number(String(item.p || "").replace(/[^0-9.]/g, "")) || null,
        /x/i.test(item.k || "") ? null : (Number(String(item.k || "").replace(/\D/g, "")) || null),
        lot, lotName || "LOCATION REQUIRED", item.photos || [], item.videos || [],
      ],
    );
  }
  await client.query("commit");
  console.log(`Imported up to ${seed.length} seed vehicles. Records with ADDRESS REQUIRED remain private until corrected.`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
