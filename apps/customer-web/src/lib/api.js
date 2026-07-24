import { supabase } from "./supabase";

export async function api(url, options) {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  const request = { ...(options || {}) };
  const headers = new Headers(request.headers || {});
  if (url.startsWith("/api/admin")) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }
  request.headers = headers;
  const response = await fetch(`${baseUrl}${url}`, request);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(body?.error || body || "Request failed.");
  return body;
}

const VEHICLE_ACRONYMS = new Set([
  "AMG", "AT4", "AWD", "BMW", "EV", "FWD", "GMC", "GT", "GTR", "HD", "HEV",
  "MDX", "N", "NX", "PHEV", "QX60", "R/T", "RDX", "RS", "SE", "SEL", "SH-AWD",
  "SL", "SR", "SUV", "TRD", "V6", "V8", "XJ", "XSE",
]);

function titleCaseVehicle(value) {
  return String(value || "").split(/\s+/).filter(Boolean).map((word) => {
    const plain = word.replace(/[^a-zA-Z0-9/-]/g, "");
    if (VEHICLE_ACRONYMS.has(plain.toUpperCase())) return word.toUpperCase();
    if (plain.toUpperCase() === "XDRIVE") return "xDrive";
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(" ");
}

export const carName = (car) => {
  const structuredName = [car.year, car.make, car.model, car.trim].filter(Boolean).join(" ");
  if (car.make || car.model) return titleCaseVehicle(structuredName);

  const raw = String(car.title || "")
    .replace(/[*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const withoutSalesCopy = raw
    .split(/\s+[-–—]\s+(?=(?:\d[\d,\sXx]*\s*KM|\$|BRAND NEW|MORE COLOU?RS|[*(]*(?:LEASE|FINANCE)))/i)[0]
    .replace(/\s+\d{1,3}(?:[,\s]\d{3}|\s*[Xx]{3})\s*KMS?\b.*$/i, "")
    .trim();
  return titleCaseVehicle(withoutSalesCopy || raw || structuredName || "Vehicle");
};

export function vehicleMileage(car) {
  const source = [car.title, car.description, car.kms].filter(Boolean).join("\n");
  const exact = source.match(/(?:^|[^\d])(\d{1,3})[,\s]+(\d{3})\s*KMS?\b/i);
  if (exact) return { value: Number(`${exact[1]}${exact[2]}`), approximate: false };
  const approximate = source.match(/(?:^|[^\d])(\d{1,3})\s*[, ]?\s*[Xx]{3}\s*KMS?\b/i);
  if (approximate) return { value: Number(approximate[1]) * 1000, approximate: true };
  const compact = source.match(/(?:^|[^\d])(\d{4,6})\s*KMS?\b/i);
  if (compact) return { value: Number(compact[1]), approximate: false };
  const short = source.match(/(?:^|[^\d])(\d{1,3})\s*[Kk]\s*(?:KMS?)?\b/);
  if (short) return { value: Number(short[1]) * 1000, approximate: true };
  const stored = Number(car.mileage);
  return Number.isFinite(stored) && stored > 0 ? { value: stored, approximate: false } : null;
}

export function mileageLabel(car) {
  const parsed = vehicleMileage(car);
  if (parsed) return `${parsed.approximate ? "Approx. " : ""}${parsed.value.toLocaleString()} km`;
  if (/brand new|new vehicle/i.test(`${car.title || ""} ${car.description || ""}`)) return "New vehicle";
  return "Mileage available";
}

export function priceLabel(car) {
  const price = Number(car.price_amount);
  return Number.isFinite(price) && price > 0 ? `$${price.toLocaleString()}` : "Contact for price";
}

export function cleanVehicleDescription(car) {
  const name = carName(car).toLowerCase().replace(/[^a-z0-9]/g, "");
  const lines = String(car.description || "").split(/\r?\n/).map((line) =>
    line.replace(/\\([_*#-])/g, "$1").replace(/[*_]/g, "").trim(),
  );
  const kept = lines.filter((line) => {
    if (!line) return true;
    const compact = line.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (compact === name) return false;
    if (/^(?:only\s+)?\d{1,3}(?:[,\s]\d{3}|\s*[x]{3})\s*kms?\.?$/i.test(line)) return false;
    if (/^clean title\b/i.test(line)) return false;
    if (/^(?:text|call|dm)\b.*(?:604|carfax|video|viewing)/i.test(line)) return false;
    if (/^dealership located\b/i.test(line)) return false;
    if (/^disclaimer:/i.test(line)) return false;
    if (/^(?:dealer|dl)\s*(?:#|license)/i.test(line)) return false;
    if (/^vin\s*:/i.test(line) || /^[A-HJ-NPR-Z0-9]{17}\b/.test(line)) return false;
    return true;
  });
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function carImages(car) {
  const normalized = [
    ...(car.images || []),
    ...(car.media || [])
      .filter((item) => item.kind === "image")
      .map((item) => item.source_url || item.storage_path),
  ];
  return [...new Set(normalized.filter((url) => url && (url.startsWith("/") || url.startsWith("http"))))];
}

export function carVideos(car) {
  const normalized = [
    ...(car.videos || []),
    ...(car.media || [])
      .filter((item) => item.kind === "video")
      .map((item) => item.source_url || item.storage_path),
  ];
  return [...new Set(normalized.filter((url) => url && (url.startsWith("/") || url.startsWith("http"))))];
}
