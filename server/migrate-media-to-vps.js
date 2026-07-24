import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { pool } from "./db.js";
import { config, validateConfig } from "./config.js";

validateConfig();
const authorization = process.env.TRELLO_API_KEY && process.env.TRELLO_API_TOKEN
  ? `OAuth oauth_consumer_key="${process.env.TRELLO_API_KEY}", oauth_token="${process.env.TRELLO_API_TOKEN}"`
  : "";
const cars = (await pool.query(
  `select c.id, c.images, c.videos,
    coalesce(json_agg(json_build_object('kind', vm.kind, 'url', vm.source_url))
      filter (where vm.id is not null), '[]') media
   from cars c left join vehicle_media vm on vm.vehicle_id = c.id
   group by c.id`,
)).rows;
let migrated = 0;
let failed = 0;

async function localize(car, kind, url, order) {
  if (!url?.startsWith("http")) return url;
  try {
    const headers = url.includes("trello.com") && authorization ? { Authorization: authorization } : {};
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get("content-type") || "";
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 250 * 1024 * 1024) throw new Error("File exceeds 250 MB");
    const digest = createHash("sha256").update(url).digest("hex").slice(0, 16);
    if (kind === "image" && type.startsWith("image/")) {
      const imageDir = path.resolve(config.uploadDir, "cars", car.id, "images");
      const thumbDir = path.resolve(config.uploadDir, "cars", car.id, "thumbs");
      await Promise.all([mkdir(imageDir, { recursive: true }), mkdir(thumbDir, { recursive: true })]);
      const filename = `${String(order).padStart(3, "0")}-${digest}.webp`;
      await Promise.all([
        sharp(bytes).rotate().resize({ width: 2200, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(imageDir, filename)),
        sharp(bytes).rotate().resize({ width: 520, height: 350, fit: "cover" }).webp({ quality: 76 }).toFile(path.join(thumbDir, filename)),
      ]);
      migrated += 1;
      return `/uploads/cars/${car.id}/images/${filename}`;
    }
    if (kind === "video" && type.startsWith("video/")) {
      const videoDir = path.resolve(config.uploadDir, "cars", car.id, "videos");
      await mkdir(videoDir, { recursive: true });
      const extension = type.includes("quicktime") ? ".mov" : ".mp4";
      const filename = `${String(order).padStart(3, "0")}-${digest}${extension}`;
      await writeFile(path.join(videoDir, filename), bytes);
      migrated += 1;
      return `/uploads/cars/${car.id}/videos/${filename}`;
    }
    throw new Error(`Unsupported content type ${type || "unknown"}`);
  } catch (error) {
    failed += 1;
    console.error(`${car.id}: ${url} — ${error.message}`);
    return url;
  }
}

for (const car of cars) {
  const remoteImages = [...new Set([...(car.images || []), ...car.media.filter((item) => item.kind === "image").map((item) => item.url)].filter(Boolean))];
  const remoteVideos = [...new Set([...(car.videos || []), ...car.media.filter((item) => item.kind === "video").map((item) => item.url)].filter(Boolean))];
  const images = [];
  const videos = [];
  for (let index = 0; index < remoteImages.length; index += 1) images.push(await localize(car, "image", remoteImages[index], index));
  for (let index = 0; index < remoteVideos.length; index += 1) videos.push(await localize(car, "video", remoteVideos[index], index));
  await pool.query("update cars set images = $1, videos = $2 where id = $3", [images, videos, car.id]);
}

await pool.end();
console.log(`VPS media migration complete: ${migrated} stored locally, ${failed} left at source for retry.`);
