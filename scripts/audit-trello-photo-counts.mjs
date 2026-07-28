import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = ["TRELLO_API_KEY", "TRELLO_API_TOKEN"];
const missingEnvironment = required.filter((key) => !process.env[key]);
if (missingEnvironment.length) {
  console.error(`Missing environment variables: ${missingEnvironment.join(", ")}`);
  process.exit(1);
}

const seed = JSON.parse(await readFile(resolve(import.meta.dirname, "../src/data/seed.json"), "utf8"));
const batchSize = 25;
const batchPauseMs = 3_000;
const pause = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function cardReference(trelloUrl = "") {
  try {
    return new URL(trelloUrl).pathname.match(/^\/c\/([^/]+)/)?.[1] || "";
  } catch {
    return "";
  }
}

async function inspectCar(car) {
  const cardId = cardReference(car.trelloUrl);
  if (!cardId) return { car, error: "Invalid Trello URL", photos: 0 };
  const url = new URL(`https://api.trello.com/1/cards/${encodeURIComponent(cardId)}`);
  url.searchParams.set("fields", "name");
  url.searchParams.set("attachments", "true");
  url.searchParams.set("attachment_fields", "id,mimeType,isUpload");
  url.searchParams.set("key", process.env.TRELLO_API_KEY);
  url.searchParams.set("token", process.env.TRELLO_API_TOKEN);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Trello HTTP ${response.status}`);
    const card = await response.json();
    const photos = (card.attachments || []).filter((attachment) =>
      attachment.isUpload !== false && (attachment.mimeType || "").startsWith("image/"),
    ).length;
    return { car, error: "", photos };
  } catch (error) {
    return {
      car,
      error: error instanceof Error ? error.message : "Unknown Trello error",
      photos: 0,
    };
  }
}

const results = [];
const cars = seed.filter((car) => cardReference(car.trelloUrl));
for (let index = 0; index < cars.length; index += batchSize) {
  results.push(...await Promise.all(cars.slice(index, index + batchSize).map(inspectCar)));
  console.log(`Checked ${Math.min(index + batchSize, cars.length)}/${cars.length} cards`);
  if (index + batchSize < cars.length) await pause(batchPauseMs);
}

const errors = results.filter((result) => result.error);
const differences = results
  .filter((result) => !result.error && result.photos !== Number(result.car.pc || 0))
  .map((result) => ({
    id: result.car.id,
    boardCount: Number(result.car.pc || 0),
    trelloCount: result.photos,
    missing: Math.max(result.photos - Number(result.car.pc || 0), 0),
    title: result.car.t,
  }))
  .sort((left, right) => right.missing - left.missing || left.title.localeCompare(right.title));

console.log(JSON.stringify({
  checkedCars: results.length,
  errors: errors.length,
  carsWithDifferentCounts: differences.length,
  missingPhotos: differences.reduce((total, item) => total + item.missing, 0),
}, null, 2));
for (const difference of differences) {
  console.log(`${difference.id} | board ${difference.boardCount} | Trello ${difference.trelloCount} | missing ${difference.missing} | ${difference.title}`);
}
for (const result of errors) {
  console.warn(`${result.car.id} | ${result.error} | ${result.car.t}`);
}
if (errors.length) process.exitCode = 2;
