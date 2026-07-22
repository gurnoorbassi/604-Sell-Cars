import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const apiKey = process.env.TRELLO_API_KEY;
const apiToken = process.env.TRELLO_API_TOKEN;
const boardId = process.env.TRELLO_BOARD_ID;

if (!apiKey || !apiToken || !boardId) {
  console.error("Set TRELLO_API_KEY, TRELLO_API_TOKEN, and TRELLO_BOARD_ID before running this command.");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const seedPath = resolve(root, "src/data/seed.json");
const mediaRoot = resolve(root, "public/media");
const auth = `OAuth oauth_consumer_key="${apiKey}", oauth_token="${apiToken}"`;
const normalize = (value = "") => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const safeName = (value, fallback) => {
  const cleaned = value.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 120) || fallback;
};
const uniqueName = (attachment, index) => {
  const extension = extname(new URL(attachment.url).pathname) ||
    (attachment.mimeType?.startsWith("image/") ? `.${attachment.mimeType.split("/")[1]}` : "");
  const base = safeName(attachment.name || `attachment-${index + 1}${extension}`, `attachment-${index + 1}`);
  return base.includes(".") || !extension ? `${index + 1}-${base}` : `${index + 1}-${base}${extension}`;
};
const findUrls = (value = "") => value.match(/https?:\/\/[^\s<>()]+/g) || [];
const isCarfax = (url) => /carfax/i.test(url);

const params = new URLSearchParams({
  key: apiKey,
  token: apiToken,
  fields: "id,name,desc,shortLink,shortUrl,closed",
  attachments: "true",
  attachment_fields: "id,name,url,mimeType,isUpload,bytes",
});
const response = await fetch(`https://api.trello.com/1/boards/${encodeURIComponent(boardId)}/cards/all?${params}`);
if (!response.ok) throw new Error(`Trello returned ${response.status}: ${await response.text()}`);
const cards = await response.json();
const byName = new Map(cards.map((card) => [normalize(card.name), card]));
const byUrl = new Map(cards.map((card) => [card.shortUrl, card]));
const seed = JSON.parse(await readFile(seedPath, "utf8"));

let matched = 0;
let downloaded = 0;
let carfaxLinks = 0;

for (const record of seed) {
  const card = byUrl.get(record.t) || byName.get(normalize(record.t));
  if (!card) continue;
  matched += 1;
  record.t = card.name;
  record.trelloUrl = card.shortUrl;

  const attachmentUrls = card.attachments?.map((item) => item.url) || [];
  const carfax = [...attachmentUrls, ...findUrls(card.desc)].find(isCarfax);
  if (carfax) {
    record.carfax = carfax;
    carfaxLinks += 1;
  }

  const media = (card.attachments || []).filter((item) =>
    item.isUpload && /^(image|video)\//.test(item.mimeType || ""),
  );
  if (!media.length) continue;

  const cardDir = resolve(mediaRoot, record.id);
  await mkdir(cardDir, { recursive: true });
  record.photos = [];
  record.videos = [];

  for (const [index, attachment] of media.entries()) {
    const filename = uniqueName(attachment, index);
    const destination = resolve(cardDir, filename);
    const download = await fetch(attachment.url, { headers: { Authorization: auth } });
    if (!download.ok) {
      console.warn(`Skipped ${card.name} / ${attachment.name}: HTTP ${download.status}`);
      continue;
    }
    await writeFile(destination, Buffer.from(await download.arrayBuffer()));
    const publicUrl = `/media/${record.id}/${encodeURIComponent(filename)}`;
    if (attachment.mimeType.startsWith("image/")) record.photos.push(publicUrl);
    else record.videos.push(publicUrl);
    downloaded += 1;
  }
  record.pc = record.photos.length;
}

await writeFile(seedPath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
console.log(`Matched ${matched}/${seed.length} inventory records.`);
console.log(`Downloaded ${downloaded} media files and recovered ${carfaxLinks} CARFAX links.`);
console.log("Review public/media size before committing; Supabase Storage is recommended for a large library.");
