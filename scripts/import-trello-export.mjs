import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const exportPath = process.argv[2];
if (!exportPath) {
  console.error("Usage: npm run import:trello-export -- C:/path/to/trello-export.json");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const seedPath = resolve(root, "src/data/seed.json");
const board = JSON.parse(await readFile(resolve(exportPath), "utf8"));
const seed = JSON.parse(await readFile(seedPath, "utf8"));

if (!Array.isArray(board.cards)) throw new Error("The selected file is not a Trello board JSON export.");

const isTrelloOnly = (title = "") => /^https:\/\/trello\.com\/c\//.test(title);
const byIdSuffix = new Map(board.cards.map((card) => [card.id.slice(-8), card]));
const findUrls = (value = "") => value.match(/https?:\/\/[^\s<>()]+/g) || [];
const cleanUrl = (url) => url.replace(/[.,;:'"!?]+$/, "");
const carfaxUrl = (card) => [
  ...findUrls(card.desc),
  ...(card.attachments || []).flatMap((attachment) => [attachment.url, ...findUrls(attachment.name)]),
].map(cleanUrl).find((url) => /carfax/i.test(url));
const previewFor = (attachment) => {
  const previews = [...(attachment.previews || [])]
    .filter((preview) => preview.width <= 1600)
    .sort((a, b) => b.width - a.width);
  return previews[0]?.url || attachment.url;
};

const uniqueSeed = seed.filter((record) => !isTrelloOnly(record.t));
let matched = 0;
let withPhotos = 0;
let carfaxLinks = 0;

for (const record of uniqueSeed) {
  const card = byIdSuffix.get(record.id);
  if (!card) continue;
  matched += 1;

  const attachments = card.attachments || [];
  const images = attachments.filter((attachment) =>
    (attachment.mimeType || "").startsWith("image/") && attachment.isUpload,
  );
  const cover = images.find((attachment) => attachment.id === card.idAttachmentCover);
  const orderedImages = cover ? [cover, ...images.filter((attachment) => attachment.id !== cover.id)] : images;
  const reportUrl = carfaxUrl(card);

  record.t = card.name || record.t;
  record.de = card.desc || record.de;
  record.trelloUrl = card.shortUrl;
  record.photos = orderedImages.map(previewFor);
  record.pc = images.length;
  record.videos = attachments
    .filter((attachment) => (attachment.mimeType || "").startsWith("video/") && attachment.isUpload)
    .map((attachment) => attachment.url);

  if (record.photos.length) withPhotos += 1;
  if (reportUrl) {
    record.carfax = reportUrl;
    carfaxLinks += 1;
  }
}

await writeFile(seedPath, `${JSON.stringify(uniqueSeed, null, 2)}\n`, "utf8");
console.log(`Removed ${seed.length - uniqueSeed.length} duplicate Trello-link records.`);
console.log(`Matched ${matched}/${uniqueSeed.length} unique inventory records.`);
console.log(`Added photo previews to ${withPhotos} cars and recovered ${carfaxLinks} CARFAX links.`);
