import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const surface = process.env.VITE_SURFACE || "site";
const publicDir = join(process.cwd(), "public");
const robotsPath = join(publicDir, "robots.txt");
const sitemapPath = join(publicDir, "sitemap.xml");
const websiteUrl = "https://604-sell-cars-website.netlify.app";
const apiUrl = "https://604-sell-cars-api.netlify.app";

await mkdir(publicDir, { recursive: true });

if (surface !== "site") {
  await writeFile(robotsPath, "User-agent: *\nDisallow: /\n", "utf8");
  await rm(sitemapPath, { force: true });
  console.log(`Generated no-index crawler rules for the ${surface} surface.`);
  process.exit(0);
}

const response = await fetch(`${apiUrl}/api/cars`);
if (!response.ok) {
  throw new Error(`Could not fetch live cars for sitemap: HTTP ${response.status}`);
}

const cars = await response.json();
const urls = [
  { location: websiteUrl },
  { location: `${websiteUrl}/inventory` },
  { location: `${websiteUrl}/about` },
  { location: `${websiteUrl}/privacy` },
  { location: `${websiteUrl}/terms` },
  { location: `${websiteUrl}/book` },
  ...cars.map((car) => ({
    location: `${websiteUrl}/cars/${encodeURIComponent(car.id)}`,
    lastModified: validDate(car.updated_at || car.created_at),
  })),
];

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map(({ location, lastModified }) => [
    "  <url>",
    `    <loc>${escapeXml(location)}</loc>`,
    lastModified ? `    <lastmod>${lastModified}</lastmod>` : "",
    "  </url>",
  ].filter(Boolean).join("\n")),
  "</urlset>",
  "",
].join("\n");

await Promise.all([
  writeFile(robotsPath, `User-agent: *\nAllow: /\nSitemap: ${websiteUrl}/sitemap.xml\n`, "utf8"),
  writeFile(sitemapPath, sitemap, "utf8"),
]);

console.log(`Generated crawler rules and a ${urls.length}-URL sitemap.`);

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : date.toISOString().slice(0, 10);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
