import { createClient } from "@supabase/supabase-js";
import type { Config, Context } from "@netlify/functions";
import { DateTime } from "luxon";

const TIMEZONE = "America/Vancouver";
const OPENING_HOUR = 10;
const CLOSING_HOUR = 19;
const DAYS_VISIBLE = 14;
const MEDIA_BUCKET = "vehicle-media";

let mediaBucketReady: Promise<void> | null = null;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function serviceClient() {
  const url = Netlify.env.get("VITE_SUPABASE_URL");
  const key = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function ensureMediaBucket(supabase: any) {
  if (!mediaBucketReady) {
    mediaBucketReady = (async () => {
      const { error: getError } = await supabase.storage.getBucket(MEDIA_BUCKET);
      if (!getError) return;
      const { error: createError } = await supabase.storage.createBucket(MEDIA_BUCKET, {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024,
      });
      if (createError && !/already exists/i.test(createError.message)) throw createError;
    })().catch((error) => {
      mediaBucketReady = null;
      throw error;
    });
  }
  return mediaBucketReady;
}

function fail(error: unknown, fallback = "Something went wrong. Please try again.") {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error || fallback);
  const clean = message
    .replace(/^.*?ERROR:\s*/i, "")
    .replace(/\s*\(SQLSTATE.*$/i, "")
    .trim();
  const expected = [
    "required", "valid", "available", "location", "future", "14 days",
    "on the hour", "between 10", "just booked", "not found",
  ].some((term) => clean.toLowerCase().includes(term));
  const status = clean.toLowerCase().includes("just booked") ? 409 : expected ? 422 : 500;
  return json({ error: expected ? clean : fallback }, status);
}

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function isPublicCar(car: Record<string, any>) {
  return car.status === "available"
    && car.lot && car.lot !== "LOCATION_REQUIRED"
    && car.lot_address && car.lot_address !== "ADDRESS REQUIRED";
}

function normalizedMileage(car: Record<string, any>) {
  const source = [car.title, car.description, car.kms].filter(Boolean).join("\n");
  const exact = source.match(/(?:^|[^\d])(\d{1,3})[,\s]+(\d{3})\s*KMS?\b/i);
  if (exact) return Number(`${exact[1]}${exact[2]}`);
  const approximate = source.match(/(?:^|[^\d])(\d{1,3})\s*[, ]?\s*[Xx]{3}\s*KMS?\b/i);
  if (approximate) return Number(approximate[1]) * 1000;
  const compact = source.match(/(?:^|[^\d])(\d{4,6})\s*KMS?\b/i);
  if (compact) return Number(compact[1]);
  const stored = Number(car.mileage);
  return Number.isFinite(stored) && stored > 0 ? stored : null;
}

function normalizedYear(car: Record<string, any>) {
  const maximum = DateTime.now().year + 1;
  const titleMatch = String(car.title || "").match(/\b((?:19|20)\d{2})\b/);
  const parsed = Number(titleMatch?.[1]);
  if (Number.isInteger(parsed) && parsed >= 1980 && parsed <= maximum) return parsed;
  const stored = Number(car.year);
  return Number.isInteger(stored) && stored >= 1980 && stored <= maximum ? stored : null;
}

function normalizedMake(value: unknown) {
  const make = clean(value, 80);
  const aliases: Record<string, string> = {
    chevorlet: "Chevrolet",
    infinity: "Infiniti",
    "mercedes benz": "Mercedes-Benz",
  };
  return aliases[make.toLowerCase()] || make;
}

function normalizeCar(car: Record<string, any>) {
  return {
    ...car,
    year: normalizedYear(car),
    make: normalizedMake(car.make),
    mileage: normalizedMileage(car),
  };
}

async function withSignedMedia(supabase: any, cars: Array<Record<string, any>>) {
  await ensureMediaBucket(supabase);
  const paths = [...new Set(cars.flatMap((car) =>
    (car.vehicle_media || []).map((item: Record<string, any>) => item.storage_path).filter(Boolean),
  ))];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 3600);
    if (error) console.error("Could not sign vehicle media URLs:", error.message);
    (data || []).forEach((item: Record<string, any>) => {
      if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
    });
  }
  return cars.map((sourceCar) => {
    const car = normalizeCar(sourceCar);
    const mediaBaseUrl = (Netlify.env.get("VITE_BOARD_URL") || "https://dealership-inventory-board.netlify.app").replace(/\/$/, "");
    const orderedMedia = [...(car.vehicle_media || [])].sort((a: Record<string, any>, b: Record<string, any>) =>
      Number(a.sort_order || 0) - Number(b.sort_order || 0) || Number(a.id || 0) - Number(b.id || 0),
    );
    return {
    ...car,
    media: orderedMedia.map((item: Record<string, any>) => ({
      ...item,
      source_url: item.storage_path && signed.get(item.storage_path)
        ? signed.get(item.storage_path)
        : trelloMediaUrl(item.source_url, mediaBaseUrl),
    })),
    vehicle_media: undefined,
  };
  });
}

function trelloMediaUrl(sourceUrl: unknown, mediaBaseUrl: string) {
  const value = clean(sourceUrl, 3000);
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname === "trello.com" && url.pathname.startsWith("/1/cards/")) {
      return `${mediaBaseUrl}/api/trello-media?url=${encodeURIComponent(value)}`;
    }
  } catch {
    // Keep non-URL media values unchanged so the normal image fallback can handle them.
  }
  return value;
}

async function requireAdmin(request: Request, supabase: any) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return { response: json({ error: "Sign in through the inventory board first." }, 401) };
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const email = userData?.user?.email?.toLowerCase();
  if (userError || !email) return { response: json({ error: "Your session expired. Please sign in again." }, 401) };
  const { data: membership, error } = await supabase
    .from("team_members")
    .select("role, active")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();
  if (error || !membership || !["owner", "admin"].includes(membership.role)) {
    return { response: json({ error: "Administrator access is required." }, 403) };
  }
  return { user: userData.user };
}

function buildSlots(bookedValues: string[]) {
  const booked = new Set(bookedValues.map((value) => DateTime.fromISO(value).toUTC().toISO()));
  const now = DateTime.now().setZone(TIMEZONE);
  const firstDayOffset = now >= now.startOf("day").set({ hour: CLOSING_HOUR }) ? 1 : 0;
  const slots: Array<Record<string, string>> = [];
  for (let day = 0; day < DAYS_VISIBLE; day += 1) {
    const date = now.startOf("day").plus({ days: day + firstDayOffset });
    for (let hour = OPENING_HOUR; hour <= CLOSING_HOUR; hour += 1) {
      const local = date.set({ hour });
      const iso = local.toUTC().toISO();
      if (local > now && iso && !booked.has(iso)) {
        slots.push({
          iso,
          dateLabel: local.toFormat("ccc, LLL d"),
          timeLabel: local.toFormat("h:mm a"),
        });
      }
    }
  }
  return slots;
}

async function publicCars(request: Request, supabase: any) {
  const url = new URL(request.url);
  const { data, error } = await supabase
    .from("cars")
    .select("*, vehicle_media(*)")
    .eq("status", "available")
    .neq("lot", "LOCATION_REQUIRED")
    .neq("lot_address", "ADDRESS REQUIRED")
    .limit(500);
  if (error) throw error;
  let rows = await withSignedMedia(supabase, (data || []).filter(isPublicCar));
  const search = clean(url.searchParams.get("search") || url.searchParams.get("q")).toLowerCase();
  const exact = (key: string, field: string) => {
    const value = clean(url.searchParams.get(key));
    if (value) rows = rows.filter((car) => String(car[field] ?? "") === value);
  };
  if (search) {
    rows = rows.filter((car) =>
      [car.year, car.make, car.model, car.trim, car.title, car.stock]
        .filter(Boolean).join(" ").toLowerCase().includes(search),
    );
  }
  exact("lot", "lot");
  exact("bodyType", "body_type");
  exact("make", "make");
  exact("year", "year");
  const fuel = clean(url.searchParams.get("fuel"));
  if (fuel) rows = rows.filter((car) => car.fuel_type === fuel || (car.fuel_tags || []).includes(fuel));
  const minPrice = Number(url.searchParams.get("minPrice"));
  const maxPrice = Number(url.searchParams.get("maxPrice"));
  const minYear = Number(url.searchParams.get("minYear"));
  const maxYear = Number(url.searchParams.get("maxYear"));
  const maxMileage = Number(url.searchParams.get("maxMileage"));
  if (Number.isFinite(minPrice) && minPrice > 0) rows = rows.filter((car) => Number(car.price_amount) >= minPrice);
  if (Number.isFinite(maxPrice) && maxPrice > 0) rows = rows.filter((car) => Number(car.price_amount) <= maxPrice);
  if (Number.isFinite(minYear) && minYear > 0) rows = rows.filter((car) => Number(car.year) >= minYear);
  if (Number.isFinite(maxYear) && maxYear > 0) rows = rows.filter((car) => Number(car.year) <= maxYear);
  if (Number.isFinite(maxMileage) && maxMileage > 0) rows = rows.filter((car) => Number(car.mileage) <= maxMileage);
  const sort = url.searchParams.get("sort");
  const number = (value: unknown, fallback = Number.MAX_SAFE_INTEGER) =>
    Number.isFinite(Number(value)) ? Number(value) : fallback;
  if (sort === "price_asc") rows.sort((a, b) => number(a.price_amount) - number(b.price_amount));
  else if (sort === "price_desc") rows.sort((a, b) => number(b.price_amount, -1) - number(a.price_amount, -1));
  else if (sort === "mileage") rows.sort((a, b) => number(a.mileage) - number(b.mileage));
  else rows.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))
    || String(b.updated_at).localeCompare(String(a.updated_at)));
  return json(rows);
}

async function carDetail(id: string, supabase: any) {
  const { data, error } = await supabase
    .from("cars")
    .select("*, vehicle_media(*)")
    .eq("id", id)
    .eq("status", "available")
    .neq("lot", "LOCATION_REQUIRED")
    .neq("lot_address", "ADDRESS REQUIRED")
    .maybeSingle();
  if (error) throw error;
  if (!data || !isPublicCar(data)) return json({ error: "Vehicle not found." }, 404);
  return json((await withSignedMedia(supabase, [data]))[0]);
}

async function slots(id: string, supabase: any) {
  const { data: car, error } = await supabase
    .from("cars")
    .select("id, lot, lot_name, lot_address, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!car || !isPublicCar(car)) return json({ error: "Vehicle unavailable or missing location." }, 404);
  const now = DateTime.now().setZone(TIMEZONE);
  const firstDayOffset = now >= now.startOf("day").set({ hour: CLOSING_HOUR }) ? 1 : 0;
  const end = now.endOf("day").plus({ days: 13 + firstDayOffset }).toUTC().toISO();
  const { data: booked, error: bookedError } = await supabase
    .from("leads")
    .select("appointment_time")
    .eq("appointment_lot", car.lot)
    .eq("appointment_status", "booked")
    .gt("appointment_time", new Date().toISOString())
    .lte("appointment_time", end);
  if (bookedError) throw bookedError;
  return json({
    car,
    timezone: TIMEZONE,
    slots: buildSlots((booked || []).map((row: Record<string, string>) => row.appointment_time)),
  });
}

async function submitLead(request: Request, supabase: any) {
  const input = await request.json();
  const name = clean(input.name, 150);
  const phone = clean(input.phone, 40);
  const carId = clean(input.carId, 150);
  const appointmentTime = clean(input.appointmentTime, 80);
  const budget = Number(input.budget);
  if (!name || !phone || !carId || !appointmentTime) {
    return json({ error: "Name, phone, vehicle, budget, and appointment time are required." }, 422);
  }
  if (!Number.isFinite(budget) || budget < 0) {
    return json({ error: "Enter a valid budget." }, 422);
  }
  if (Number.isNaN(Date.parse(appointmentTime))) {
    return json({ error: "Enter a valid appointment time." }, 422);
  }
  const { data, error } = await supabase.rpc("submit_lead", {
    p_name: name,
    p_phone: phone,
    p_email: clean(input.email, 200),
    p_car_id: carId,
    p_budget: budget,
    p_appointment_time: appointmentTime,
  });
  if (error) throw error;
  return json(data, data?.isNew ? 201 : 200);
}

async function filters(supabase: any) {
  const { data, error } = await supabase
    .from("cars")
    .select("title, lot, lot_address, body_type, fuel_type, make, year")
    .eq("status", "available")
    .neq("lot", "LOCATION_REQUIRED")
    .neq("lot_address", "ADDRESS REQUIRED");
  if (error) throw error;
  const normalized = (data || []).map(normalizeCar);
  const unique = (key: string, descending = false) =>
    [...new Set(normalized.map((row: Record<string, any>) => row[key]).filter(Boolean))]
      .sort((a: any, b: any) => descending ? Number(b) - Number(a) : String(a).localeCompare(String(b)));
  return json({
    lots: unique("lot"),
    body_types: unique("body_type"),
    fuel_types: unique("fuel_type"),
    makes: unique("make"),
    years: unique("year", true),
  });
}

function carRow(input: Record<string, any>, id: string) {
  const year = Number(input.year);
  const price = Number(input.price);
  const mileage = Number(input.mileage);
  for (const [field, value] of [
    ["make", input.make], ["model", input.model], ["lot", input.lot],
    ["lotName", input.lotName], ["lotAddress", input.lotAddress],
  ]) {
    if (!clean(value)) throw new Error(`${field} is required.`);
  }
  if (!Number.isFinite(year) || year < 1900) throw new Error("year must be a valid number.");
  if (!Number.isFinite(price) || price < 0) throw new Error("price must be a valid number.");
  if (!Number.isFinite(mileage) || mileage < 0) throw new Error("mileage must be a valid number.");
  if (!["available", "sold"].includes(input.status)) throw new Error("Status must be available or sold.");
  const title = [year, clean(input.make), clean(input.model), clean(input.trim)].filter(Boolean).join(" ");
  return {
    id,
    title,
    stock: clean(input.stock),
    price: String(price),
    kms: String(mileage),
    dealership: clean(input.lotName),
    body_type: clean(input.bodyType),
    fuel_tags: Array.isArray(input.fuelTags) ? input.fuelTags.map((value: unknown) => clean(value, 60)).filter(Boolean) : [],
    labels: Array.isArray(input.labels) ? input.labels.map((value: unknown) => clean(value, 60)).filter(Boolean) : [],
    description: clean(input.description, 20_000),
    carfax_url: clean(input.carfaxUrl, 1_000),
    status: input.status,
    year,
    make: clean(input.make),
    model: clean(input.model),
    trim: clean(input.trim) || null,
    price_amount: price,
    mileage,
    lot: clean(input.lot),
    lot_name: clean(input.lotName),
    lot_address: clean(input.lotAddress, 1_000),
    fuel_type: clean(input.fuelType),
    featured: Boolean(input.featured),
    updated_at: new Date().toISOString(),
  };
}

async function adminRoute(request: Request, pathname: string, supabase: any) {
  const auth = await requireAdmin(request, supabase);
  if (auth.response) return auth.response;
  const url = new URL(request.url);

  if (request.method === "GET" && pathname === "/api/admin/leads") {
    let query = supabase
      .from("leads")
      .select("*, cars!leads_car_id_fkey(year, make, model, trim, title, lot, lot_name, lot_address)")
      .order("created_at", { ascending: false });
    const lot = clean(url.searchParams.get("lot"));
    const date = clean(url.searchParams.get("date"));
    if (lot) query = query.eq("appointment_lot", lot);
    if (date) {
      const start = DateTime.fromISO(date, { zone: TIMEZONE }).startOf("day").toUTC().toISO();
      const end = DateTime.fromISO(date, { zone: TIMEZONE }).endOf("day").toUTC().toISO();
      query = query.gte("appointment_time", start).lte("appointment_time", end);
    }
    const { data, error } = await query;
    if (error) throw error;
    return json((data || []).map((lead: Record<string, any>) => ({
      ...lead,
      ...(lead.cars || {}),
      cars: undefined,
    })));
  }

  const leadMatch = pathname.match(/^\/api\/admin\/leads\/(\d+)$/);
  if (request.method === "PATCH" && leadMatch) {
    const input = await request.json();
    if (input.appointmentStatus && !["booked", "cancelled"].includes(input.appointmentStatus)) {
      return json({ error: "Invalid appointment status." }, 422);
    }
    const { data, error } = await supabase.from("leads").update({
      assigned_to: clean(input.assignedTo) || null,
      notes: clean(input.notes, 20_000) || null,
      appointment_status: input.appointmentStatus || undefined,
    }).eq("id", leadMatch[1]).select().maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "Lead not found." }, 404);
    return json(data);
  }

  if (request.method === "GET" && pathname === "/api/admin/cars") {
    const { data, error } = await supabase.from("cars").select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    return json((data || []).map(normalizeCar));
  }

  if (request.method === "GET" && pathname === "/api/admin/lots") {
    const { data, error } = await supabase
      .from("cars").select("lot, lot_name").neq("lot", "LOCATION_REQUIRED").order("lot_name");
    if (error) throw error;
    const seen = new Set<string>();
    return json((data || []).filter((row: Record<string, string>) => {
      if (seen.has(row.lot)) return false;
      seen.add(row.lot);
      return true;
    }));
  }

  const carMatch = pathname.match(/^\/api\/admin\/cars\/([^/]+)$/);
  if ((request.method === "POST" && pathname === "/api/admin/cars") || (request.method === "PUT" && carMatch)) {
    const input = await request.json();
    const id = carMatch ? decodeURIComponent(carMatch[1]) : crypto.randomUUID();
    const row = carRow(input, id);
    const { data, error } = await supabase.from("cars").upsert(row, { onConflict: "id" }).select().single();
    if (error) throw error;
    return json(data, carMatch ? 200 : 201);
  }

  const mediaMatch = pathname.match(/^\/api\/admin\/cars\/([^/]+)\/media$/);
  if (request.method === "POST" && mediaMatch) {
    const carId = decodeURIComponent(mediaMatch[1]);
    const form = await request.formData();
    const files = form.getAll("media").filter((value): value is File => value instanceof File);
    if (!files.length) return json({ error: "Choose at least one file." }, 422);
    const { data: existing, error: existingError } = await supabase
      .from("vehicle_media").select("sort_order").eq("vehicle_id", carId).order("sort_order", { ascending: false }).limit(1);
    if (existingError) throw existingError;
    let sortOrder = Number(existing?.[0]?.sort_order || 0) + 1;
    const inserted = [];
    for (const file of files) {
      const kind = file.type.startsWith("video/") ? "video" : "image";
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || `${kind}.bin`;
      const storagePath = `${carId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("vehicle-media").upload(
        storagePath,
        await file.arrayBuffer(),
        { contentType: file.type || "application/octet-stream", upsert: false },
      );
      if (uploadError) throw uploadError;
      const { data: media, error: mediaError } = await supabase.from("vehicle_media").insert({
        vehicle_id: carId,
        kind,
        source_url: "",
        storage_path: storagePath,
        sort_order: sortOrder,
        mime_type: file.type || null,
      }).select().single();
      if (mediaError) {
        await supabase.storage.from("vehicle-media").remove([storagePath]);
        throw mediaError;
      }
      inserted.push(media);
      sortOrder += 1;
    }
    return json({ uploaded: inserted.length });
  }

  return json({ error: "Not found." }, 404);
}

export default async (request: Request, _context: Context) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  const supabase = serviceClient();
  if (!supabase) return withCors(json({ error: "Database API is not configured." }, 503));
  const pathname = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  try {
    if (pathname.startsWith("/api/admin")) return withCors(await adminRoute(request, pathname, supabase));
    if (request.method === "GET" && pathname === "/api/config") {
      return withCors(json({ metaPixelId: Netlify.env.get("META_PIXEL_ID") || "", timezone: TIMEZONE }));
    }
    if (request.method === "GET" && pathname === "/api/cars") return withCors(await publicCars(request, supabase));
    if (request.method === "GET" && pathname === "/api/filters") return withCors(await filters(supabase));
    const slotMatch = pathname.match(/^\/api\/cars\/([^/]+)\/slots$/);
    if (request.method === "GET" && slotMatch) return withCors(await slots(decodeURIComponent(slotMatch[1]), supabase));
    const carMatch = pathname.match(/^\/api\/cars\/([^/]+)$/);
    if (request.method === "GET" && carMatch) return withCors(await carDetail(decodeURIComponent(carMatch[1]), supabase));
    if (request.method === "POST" && pathname === "/api/leads") return withCors(await submitLead(request, supabase));
    return withCors(json({ error: "Not found." }, 404));
  } catch (error) {
    console.error("API request failed", { pathname, error });
    return withCors(fail(error));
  }
};

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export const config: Config = {
  path: "/api/*",
  excludedPath: ["/api/health", "/api/generate-description", "/api/trello-media"],
};
