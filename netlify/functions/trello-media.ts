import { createClient } from "@supabase/supabase-js";
import type { Config, Context } from "@netlify/functions";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const MAX_URLS_PER_REQUEST = 3000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isAllowedTrelloMediaUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "trello.com"
      && url.pathname.startsWith("/1/cards/")
      && url.pathname.includes("/attachments/")
      && (url.pathname.includes("/previews/") || url.pathname.includes("/download/"));
  } catch {
    return false;
  }
}

async function hmac(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifySignature(value: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = await hmac(value, secret);
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return difference === 0;
}

async function createSignedUrls(request: Request) {
  const supabaseKey = Netlify.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    || request.headers.get("x-supabase-publishable-key");
  const signingSecret = Netlify.env.get("TRELLO_MEDIA_SIGNING_SECRET");
  if (!supabaseKey || !signingSecret) return json({ error: "Media access is not configured." }, 503);

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return json({ error: "Please sign in again." }, 401);

  const supabase = createClient("https://uduartuijwldxhgpmwks.supabase.co", supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user?.email) return json({ error: "Your session expired. Please sign in again." }, 401);

  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("active")
    .eq("email", userData.user.email.toLowerCase())
    .eq("active", true)
    .maybeSingle();
  if (membershipError || !membership) return json({ error: "Inventory access is disabled." }, 403);

  let input: { urls?: unknown };
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (!Array.isArray(input.urls) || input.urls.length > MAX_URLS_PER_REQUEST) {
    return json({ error: "Invalid media list." }, 400);
  }

  const urls = [...new Set(input.urls.filter((url): url is string =>
    typeof url === "string" && isAllowedTrelloMediaUrl(url),
  ))];
  const expires = Date.now() + SIX_HOURS_MS;
  const origin = new URL(request.url).origin;
  const signedEntries = await Promise.all(urls.map(async (url) => {
    const signature = await hmac(`${expires}\n${url}`, signingSecret);
    const proxyUrl = new URL("/api/trello-media", origin);
    proxyUrl.searchParams.set("url", url);
    proxyUrl.searchParams.set("expires", String(expires));
    proxyUrl.searchParams.set("signature", signature);
    return [url, proxyUrl.toString()];
  }));

  return json({ urls: Object.fromEntries(signedEntries) });
}

async function serveMedia(request: Request) {
  const apiKey = Netlify.env.get("TRELLO_API_KEY");
  const apiToken = Netlify.env.get("TRELLO_API_TOKEN");
  const signingSecret = Netlify.env.get("TRELLO_MEDIA_SIGNING_SECRET");
  if (!apiKey || !apiToken) return new Response("Media access is not configured.", { status: 503 });

  const requestUrl = new URL(request.url);
  const mediaUrl = requestUrl.searchParams.get("url") || "";
  const expires = Number(requestUrl.searchParams.get("expires"));
  const signature = requestUrl.searchParams.get("signature") || "";
  const hasValidSignature = Boolean(signingSecret)
    && Number.isFinite(expires)
    && expires >= Date.now()
    && expires <= Date.now() + SIX_HOURS_MS + 60_000
    && await verifySignature(`${expires}\n${mediaUrl}`, signature, signingSecret || "");
  if (!isAllowedTrelloMediaUrl(mediaUrl)
    || (!hasValidSignature && !await isPublicInventoryMedia(mediaUrl))) {
    return new Response("Invalid or expired media link.", { status: 403 });
  }

  const upstream = await fetch(mediaUrl, {
    headers: {
      Authorization: `OAuth oauth_consumer_key="${apiKey}", oauth_token="${apiToken}"`,
    },
  });
  if (!upstream.ok || !upstream.body) return new Response("Trello media is unavailable.", { status: 502 });

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
    return new Response("Unsupported media response.", { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "Netlify-CDN-Cache-Control": "public, durable, max-age=604800, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function isPublicInventoryMedia(mediaUrl: string) {
  const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL");
  const serviceRoleKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return false;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: media, error: mediaError } = await supabase
    .from("vehicle_media")
    .select("vehicle_id")
    .eq("source_url", mediaUrl)
    .eq("kind", "image")
    .maybeSingle();
  if (mediaError || !media?.vehicle_id) return false;
  const { data: car, error: carError } = await supabase
    .from("cars")
    .select("status, lot, lot_address")
    .eq("id", media.vehicle_id)
    .maybeSingle();
  return !carError
    && car?.status === "available"
    && Boolean(car.lot)
    && car.lot !== "LOCATION_REQUIRED"
    && Boolean(car.lot_address)
    && car.lot_address !== "ADDRESS REQUIRED";
}

export default async (request: Request, _context: Context) => {
  if (request.method === "POST") return createSignedUrls(request);
  if (request.method === "GET") return serveMedia(request);
  return new Response("Method not allowed.", { status: 405 });
};

export const config: Config = {
  path: "/api/trello-media",
};
