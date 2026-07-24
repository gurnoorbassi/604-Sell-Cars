export async function api(url, options) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(body?.error || body || "Request failed.");
  return body;
}

export const carName = (car) =>
  [car.year, car.make, car.model, car.trim].filter(Boolean).join(" ") || car.title || "Vehicle";

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
