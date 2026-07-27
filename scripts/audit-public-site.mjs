const API_BASE = process.env.AUDIT_API_BASE || "https://604-sell-cars-api.netlify.app";
const WEBSITE_BASE = process.env.AUDIT_WEBSITE_BASE || "https://604-sell-cars-website.netlify.app";
const failures = [];

const requiredRoutes = ["/", "/inventory", "/does-not-exist"];
const routeResults = await Promise.all(requiredRoutes.map(async (path) => {
  const response = await fetch(`${WEBSITE_BASE}${path}`, { redirect: "follow" });
  if (!response.ok) failures.push(`${path} returned HTTP ${response.status}`);
  return { path, status: response.status };
}));

const [carsResponse, filtersResponse, configResponse, heroResponse] = await Promise.all([
  fetch(`${API_BASE}/api/cars`),
  fetch(`${API_BASE}/api/filters`),
  fetch(`${API_BASE}/api/config`),
  fetch(`${API_BASE}/api/cars?hero=1`),
]);

for (const [name, response] of [
  ["cars", carsResponse],
  ["filters", filtersResponse],
  ["config", configResponse],
  ["hero", heroResponse],
]) {
  if (!response.ok) failures.push(`${name} API returned HTTP ${response.status}`);
}

if (failures.length) finish();

const cars = await carsResponse.json();
const filters = await filtersResponse.json();
await configResponse.json();
const heroCars = await heroResponse.json();
const uniqueIds = new Set(cars.map((car) => String(car.id)));

if (uniqueIds.size !== cars.length) failures.push(`Public inventory contains ${cars.length - uniqueIds.size} duplicate IDs`);
if (!Array.isArray(filters.makes) || !Array.isArray(filters.body_types)) failures.push("Filter payload is incomplete");
if (heroCars.length < 4) failures.push(`Hero API returned only ${heroCars.length} vehicles`);

const highEndPattern = /\b(C63S?|GLE63S?|ROLLS[\s-]*ROYCE|E63S?|GLC63S?|S63S?|AMG|PORSCHE|RS[57]|BENTLEY|MASERATI|FERRARI|LAMBORGHINI|MCLAREN|ASTON MARTIN)\b/i;
for (const car of heroCars.slice(0, 10)) {
  const identity = `${car.title || ""} ${car.year || ""} ${car.make || ""} ${car.model || ""}`;
  if (!highEndPattern.test(identity)) failures.push(`Non-high-end hero vehicle: ${identity.trim()}`);
}

let detailChecks = 0;
let imageChecks = 0;
await mapLimit(cars, 10, async (car) => {
  const detailResponse = await fetch(`${API_BASE}/api/cars/${encodeURIComponent(car.id)}`);
  if (!detailResponse.ok) {
    failures.push(`Vehicle ${car.id} detail returned HTTP ${detailResponse.status}`);
    return;
  }

  const detail = await detailResponse.json();
  detailChecks += 1;
  if (String(detail.id) !== String(car.id)) failures.push(`Vehicle ${car.id} detail ID mismatch`);
  if (!detail.location_label) failures.push(`Vehicle ${car.id} has no public location label`);
  if (!Array.isArray(detail.media)) failures.push(`Vehicle ${car.id} media is not an array`);

  const cover = detail.media?.find((item) => item.kind === "image")?.source_url;
  if (!cover) return;

  try {
    const imageResponse = await fetch(cover, { headers: { Range: "bytes=0-0" }, redirect: "follow" });
    imageResponse.body?.cancel();
    if (!imageResponse.ok) failures.push(`Vehicle ${car.id} cover image returned HTTP ${imageResponse.status}`);
    else imageChecks += 1;
  } catch (error) {
    failures.push(`Vehicle ${car.id} cover image failed: ${error.message}`);
  }
});

finish({
  routes: routeResults,
  publicVehicles: cars.length,
  vehicleDetailsChecked: detailChecks,
  coverImagesChecked: imageChecks,
  heroVehicles: heroCars.slice(0, 10).map((car) => car.title || `${car.year || ""} ${car.make || ""} ${car.model || ""}`.trim()),
});

async function mapLimit(items, limit, operation) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await operation(items[index], index);
    }
  });
  await Promise.all(workers);
}

function finish(summary = {}) {
  console.log(JSON.stringify({ ...summary, failures }, null, 2));
  if (failures.length) process.exit(1);
}
