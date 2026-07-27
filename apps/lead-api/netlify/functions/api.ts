import { createClient } from "@supabase/supabase-js";
import type { Config, Context } from "@netlify/functions";
import { DateTime } from "luxon";

const TIMEZONE = "America/Vancouver";
const OPENING_HOUR = 10;
const CLOSING_HOUR = 19;
const DAYS_VISIBLE = 14;
const MINIMUM_NOTICE_HOURS = 24;
const MEDIA_BUCKET = "vehicle-media";
const SELLER_MEDIA_BUCKET = "seller-submissions";
const PUBLIC_LABELS = new Set([
  "PRICE DROP", "GREAT VALUE", "LOW FINANCE RATE", "NEW ARRIVAL", "LOW KM", "CERTIFIED",
]);
const PAYMENT_METHODS = new Set(["Cash", "Finance", "Lease"]);
const CREDIT_RANGES = new Set(["Excellent (750+)", "Good (680–749)", "Fair (600–679)", "Rebuilding (under 600)", "Not sure"]);
const HEARD_FROM = new Set(["Instagram", "Facebook", "Google", "Referral", "Other"]);
const HANDOFF_STATUSES = new Set(["pending_confirmation", "verified", "handed_off", "source_alternative", "closed"]);

let mediaBucketReady: Promise<void> | null = null;
let sellerBucketReady: Promise<void> | null = null;

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

function ensureBucket(
  supabase: any,
  bucket: string,
  limit: number,
  state: Promise<void> | null,
  setState: (value: Promise<void> | null) => void,
) {
  if (!state) {
    state = (async () => {
      const { error: getError } = await supabase.storage.getBucket(bucket);
      if (!getError) return;
      const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: false,
        fileSizeLimit: limit,
      });
      if (createError && !/already exists/i.test(createError.message)) throw createError;
    })().catch((error) => {
      setState(null);
      throw error;
    });
    setState(state);
  }
  return state;
}

function ensureMediaBucket(supabase: any) {
  return ensureBucket(supabase, MEDIA_BUCKET, 50 * 1024 * 1024, mediaBucketReady, (value) => {
    mediaBucketReady = value;
  });
}

function ensureSellerBucket(supabase: any) {
  return ensureBucket(supabase, SELLER_MEDIA_BUCKET, 12 * 1024 * 1024, sellerBucketReady, (value) => {
    sellerBucketReady = value;
  });
}

function fail(error: unknown, fallback = "Something went wrong. Please try again.") {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error || fallback);
  const cleanMessage = message
    .replace(/^.*?ERROR:\s*/i, "")
    .replace(/\s*\(SQLSTATE.*$/i, "")
    .trim();
  const expected = [
    "required", "valid", "available", "location", "future", "14 days", "24 hours",
    "on the hour", "between 10", "just booked", "not found", "maximum", "image",
  ].some((term) => cleanMessage.toLowerCase().includes(term));
  const status = cleanMessage.toLowerCase().includes("just booked") ? 409 : expected ? 422 : 500;
  return json({ error: expected ? cleanMessage : fallback }, status);
}

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizePhone(value: unknown) {
  const digits = clean(value, 40).replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  throw new Error("Enter a valid phone number.");
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

function cityForCar(car: Record<string, any>) {
  const location = [car.lot_address, car.lot_name, car.lot, car.dealership].filter(Boolean).join(" ");
  if (/\blangley\b/i.test(location)) return "Langley";
  if (/\bsurrey\b/i.test(location)) return "Surrey";
  if (/\bcoquitlam\b/i.test(location)) return "Coquitlam";
  if (/\bburnaby\b/i.test(location)) return "Burnaby";
  if (/\bvancouver\b/i.test(location)) return "Vancouver";
  return "Lower Mainland";
}

function locationLabel(city: string) {
  return city === "Lower Mainland" ? city : `Near ${city}`;
}

function redactDealerText(value: unknown, car: Record<string, any>) {
  let output = clean(value, 20_000);
  const privateValues = [car.lot_name, car.lot, car.dealership, car.lot_address]
    .map((item) => clean(item, 1_000))
    .filter((item) => item && !["LOCATION_REQUIRED", "ADDRESS REQUIRED"].includes(item))
    .sort((a, b) => b.length - a.length);
  for (const privateValue of privateValues) {
    output = output.split(privateValue).join(locationLabel(cityForCar(car)));
  }
  return output
    .replace(/(\bNear (?:Langley|Surrey|Coquitlam|Burnaby|Vancouver))\s*[–—-]\s*\d{2,6}[^\r\n]*/gi, "$1")
    .replace(/\b(?:20247\s+Langley\s+Bypass|5933\s+200\s+(?:St|Street)|16065\s+Fraser\s+Hwy|1288\s+Lougheed\s+Hwy)\b[^\r\n]*/gi, "")
    .replace(/^dealership located.*$/gim, "")
    .replace(/^\s*(?:📞\s*)?(?:text|call|dm)\b.*$/gim, "")
    .replace(/^\s*\**(?:dealer|dl)\s*(?:#|number|license).*$/gim, "")
    .replace(/https?:\/\/[^\s)]+/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function publicCarPayload(source: Record<string, any>) {
  const car = normalizeCar(source);
  const city = cityForCar(car);
  return {
    id: car.id,
    title: redactDealerText(car.title, car),
    stock: clean(car.stock, 100) || null,
    year: car.year,
    make: car.make,
    model: clean(car.model, 100),
    trim: clean(car.trim, 100) || null,
    price_amount: Number(car.price_amount) || 0,
    mileage: car.mileage,
    body_type: clean(car.body_type, 80) || null,
    fuel_type: clean(car.fuel_type, 80) || null,
    fuel_tags: Array.isArray(car.fuel_tags) ? car.fuel_tags : [],
    description: redactDealerText(car.description, car),
    carfax_url: clean(car.carfax_url, 1_000) || null,
    featured: Boolean(car.featured),
    public_labels: (Array.isArray(car.public_labels) ? car.public_labels : [])
      .filter((label: unknown) => PUBLIC_LABELS.has(clean(label, 60))),
    created_at: car.created_at,
    updated_at: car.updated_at,
    city,
    location_label: locationLabel(city),
    media: Array.isArray(car.media) ? car.media.map((item: Record<string, any>) => ({
      id: item.id,
      kind: item.kind,
      source_url: item.source_url,
      sort_order: item.sort_order,
      mime_type: item.mime_type,
    })) : [],
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
  const mediaBaseUrl = (Netlify.env.get("VITE_BOARD_URL") || "https://dealership-inventory-board.netlify.app").replace(/\/$/, "");
  return cars.map((sourceCar) => {
    const car = normalizeCar(sourceCar);
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
  const value = clean(sourceUrl, 3_000);
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname === "trello.com" && url.pathname.startsWith("/1/cards/")) {
      return `${mediaBaseUrl}/api/trello-media?url=${encodeURIComponent(value)}`;
    }
  } catch {
    // Keep malformed values unchanged so the image component can show its fallback.
  }
  return value;
}

async function requireTeam(request: Request, supabase: any, allowedRoles = ["owner", "admin", "bdc"]) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return { response: json({ error: "Sign in through the inventory board first." }, 401) };
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const email = userData?.user?.email?.toLowerCase();
  if (userError || !email) return { response: json({ error: "Your session expired. Please sign in again." }, 401) };
  const { data: membership, error } = await supabase
    .from("team_members")
    .select("email, role, active, lot_access")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();
  if (error || !membership || !allowedRoles.includes(membership.role)) {
    return { response: json({ error: "You do not have access to this workspace." }, 403) };
  }
  return { user: userData.user, membership };
}

function buildSlots(bookedValues: string[]) {
  const booked = new Set(bookedValues.map((value) => DateTime.fromISO(value).toUTC().toISO()));
  const now = DateTime.now().setZone(TIMEZONE);
  const earliest = now.plus({ hours: MINIMUM_NOTICE_HOURS });
  const end = now.endOf("day").plus({ days: DAYS_VISIBLE - 1 });
  const slots: Array<Record<string, string>> = [];
  for (let day = 0; day < DAYS_VISIBLE; day += 1) {
    const date = now.startOf("day").plus({ days: day });
    for (let hour = OPENING_HOUR; hour <= CLOSING_HOUR; hour += 1) {
      const local = date.set({ hour });
      const iso = local.toUTC().toISO();
      if (local >= earliest && local <= end && iso && !booked.has(iso)) {
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
  const exact = (key: string, getter: (car: Record<string, any>) => unknown) => {
    const value = clean(url.searchParams.get(key));
    if (value) rows = rows.filter((car) => String(getter(car) ?? "") === value);
  };
  if (search) {
    rows = rows.filter((car) =>
      [car.year, car.make, car.model, car.trim, car.title, car.stock]
        .filter(Boolean).join(" ").toLowerCase().includes(search),
    );
  }
  exact("city", cityForCar);
  exact("bodyType", (car) => car.body_type);
  exact("make", (car) => car.make);
  exact("year", (car) => car.year);
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
  else if (sort === "newest") rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  else rows.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))
    || String(b.updated_at).localeCompare(String(a.updated_at)));
  return json(rows.map(publicCarPayload));
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
  return json(publicCarPayload((await withSignedMedia(supabase, [data]))[0]));
}

async function slots(id: string, supabase: any) {
  const { data: car, error } = await supabase
    .from("cars")
    .select("id, lot, lot_name, lot_address, dealership, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!car || !isPublicCar(car)) return json({ error: "Vehicle unavailable or missing location." }, 404);
  const end = DateTime.now().setZone(TIMEZONE).endOf("day").plus({ days: DAYS_VISIBLE - 1 }).toUTC().toISO();
  const { data: booked, error: bookedError } = await supabase
    .from("leads")
    .select("appointment_time")
    .eq("appointment_lot", car.lot)
    .eq("appointment_status", "booked")
    .gt("appointment_time", new Date().toISOString())
    .lte("appointment_time", end);
  if (bookedError) throw bookedError;
  const city = cityForCar(car);
  return json({
    car: { id: car.id, city, location_label: locationLabel(city) },
    timezone: TIMEZONE,
    minimumNoticeHours: MINIMUM_NOTICE_HOURS,
    slots: buildSlots((booked || []).map((row: Record<string, string>) => row.appointment_time)),
  });
}

async function submitLead(request: Request, supabase: any) {
  const input = await request.json();
  const name = clean(input.name, 150);
  const phone = clean(input.phone, 40);
  const email = clean(input.email, 200);
  const carId = clean(input.carId, 150);
  const appointmentTime = clean(input.appointmentTime, 80);
  const paymentMethod = clean(input.paymentMethod, 20);
  const creditRange = clean(input.creditRange, 80);
  const heardFrom = clean(input.heardFrom, 40);
  const budget = Number(input.budget);
  const downPayment = input.downPayment === "" || input.downPayment == null ? null : Number(input.downPayment);
  if (!name || !phone || !email || !carId || !appointmentTime || !paymentMethod || !heardFrom) {
    return json({ error: "Name, phone, email, vehicle, budget, payment method, appointment time, and how you heard about us are required." }, 422);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 422);
  if (!Number.isFinite(budget) || budget < 0) return json({ error: "Enter a valid budget." }, 422);
  if (!PAYMENT_METHODS.has(paymentMethod)) return json({ error: "Choose Cash, Finance, or Lease." }, 422);
  if (["Finance", "Lease"].includes(paymentMethod) && (!Number.isFinite(downPayment) || Number(downPayment) < 0)) {
    return json({ error: "Enter a valid down payment." }, 422);
  }
  if (creditRange && !CREDIT_RANGES.has(creditRange)) return json({ error: "Choose a valid credit range." }, 422);
  if (!HEARD_FROM.has(heardFrom)) return json({ error: "Choose how you heard about us." }, 422);
  if (Number.isNaN(Date.parse(appointmentTime))) return json({ error: "Enter a valid appointment time." }, 422);
  const { data, error } = await supabase.rpc("submit_lead", {
    p_name: name,
    p_phone: phone,
    p_email: email,
    p_car_id: carId,
    p_budget: budget,
    p_payment_method: paymentMethod,
    p_down_payment: downPayment,
    p_credit_range: creditRange || null,
    p_appointment_time: appointmentTime,
    p_heard_from: heardFrom,
    p_customer_notes: clean(input.notes, 5_000) || null,
  });
  if (error) throw error;
  return json(data, data?.isNew ? 201 : 200);
}

async function submitSellerLead(request: Request, supabase: any) {
  const form = await request.formData();
  const name = clean(form.get("name"), 150);
  const phone = normalizePhone(form.get("phone"));
  const vehicle = clean(form.get("vehicle"), 500);
  const files = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
  if (!name || !vehicle) throw new Error("Name, phone, and vehicle are required.");
  if (files.length > 8) throw new Error("Upload a maximum of 8 images.");
  if (files.some((file) => !file.type.startsWith("image/"))) throw new Error("Seller uploads must be images.");
  if (files.some((file) => file.size > 12 * 1024 * 1024)) throw new Error("Each image must be 12 MB or smaller.");

  const { data: sellerLead, error: upsertError } = await supabase.from("seller_leads").upsert({
    name,
    phone,
    vehicle,
    source: "604SELLSCARS",
    status: "new",
    updated_at: new Date().toISOString(),
  }, { onConflict: "phone" }).select().single();
  if (upsertError) throw upsertError;

  if (files.length) {
    await ensureSellerBucket(supabase);
    const paths: string[] = [];
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "vehicle.jpg";
      const storagePath = `${sellerLead.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from(SELLER_MEDIA_BUCKET).upload(
        storagePath,
        await file.arrayBuffer(),
        { contentType: file.type || "image/jpeg", upsert: false },
      );
      if (uploadError) throw uploadError;
      paths.push(storagePath);
    }
    const { error: mediaError } = await supabase.from("seller_leads")
      .update({ media_paths: paths, updated_at: new Date().toISOString() })
      .eq("id", sellerLead.id);
    if (mediaError) throw mediaError;
  }
  return json({
    message: "Thanks — our team will review your vehicle and contact you within one business day.",
  }, 201);
}

async function filters(supabase: any) {
  const { data, error } = await supabase
    .from("cars")
    .select("title, lot, lot_name, lot_address, dealership, body_type, fuel_type, make, year")
    .eq("status", "available")
    .neq("lot", "LOCATION_REQUIRED")
    .neq("lot_address", "ADDRESS REQUIRED");
  if (error) throw error;
  const normalized = (data || []).map(normalizeCar);
  const unique = (getter: (row: Record<string, any>) => unknown, descending = false) =>
    [...new Set(normalized.map(getter).filter(Boolean))]
      .sort((a: any, b: any) => descending ? Number(b) - Number(a) : String(a).localeCompare(String(b)));
  return json({
    cities: unique(cityForCar),
    body_types: unique((row) => row.body_type),
    fuel_types: unique((row) => row.fuel_type),
    makes: unique((row) => row.make),
    years: unique((row) => row.year, true),
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
  const internalLabels = Array.isArray(input.internalLabels || input.labels)
    ? (input.internalLabels || input.labels).map((value: unknown) => clean(value, 60)).filter(Boolean)
    : [];
  const publicLabels = Array.isArray(input.publicLabels)
    ? input.publicLabels.map((value: unknown) => clean(value, 60)).filter((label: string) => PUBLIC_LABELS.has(label))
    : [];
  return {
    id,
    title,
    stock: clean(input.stock),
    price: String(price),
    kms: String(mileage),
    dealership: clean(input.lotName),
    body_type: clean(input.bodyType),
    fuel_tags: Array.isArray(input.fuelTags) ? input.fuelTags.map((value: unknown) => clean(value, 60)).filter(Boolean) : [],
    labels: internalLabels,
    internal_labels: internalLabels,
    public_labels: publicLabels,
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

function accessibleLots(membership: Record<string, any>) {
  return Array.isArray(membership.lot_access)
    ? membership.lot_access.map((lot: unknown) => clean(lot, 200)).filter(Boolean)
    : [];
}

async function adminRoute(request: Request, pathname: string, supabase: any) {
  const auth = await requireTeam(request, supabase);
  if (auth.response) return auth.response;
  const membership = auth.membership as Record<string, any>;
  const isManager = ["owner", "admin"].includes(membership.role);
  const url = new URL(request.url);

  if (request.method === "GET" && pathname === "/api/admin/leads") {
    let query = supabase
      .from("leads")
      .select("*, cars!leads_car_id_fkey(year, make, model, trim, title, status, lot, lot_name, lot_address)")
      .order("created_at", { ascending: false });
    const lots = accessibleLots(membership);
    if (!isManager) {
      if (!lots.length) return json([]);
      query = query.in("appointment_lot", lots);
    }
    const lot = clean(url.searchParams.get("lot"));
    const date = clean(url.searchParams.get("date"));
    if (lot) {
      if (!isManager && !lots.includes(lot)) return json({ error: "You do not have access to that lot." }, 403);
      query = query.eq("appointment_lot", lot);
    }
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
      routing_flag: lead.cars?.status !== "available" ? "SOURCE ALTERNATIVE" : lead.routing_flag,
      cars: undefined,
    })));
  }

  const leadMatch = pathname.match(/^\/api\/admin\/leads\/(\d+)$/);
  if (request.method === "PATCH" && leadMatch) {
    const { data: current, error: currentError } = await supabase.from("leads")
      .select("id, appointment_lot, assigned_to")
      .eq("id", leadMatch[1])
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return json({ error: "Lead not found." }, 404);
    if (!isManager && !accessibleLots(membership).includes(current.appointment_lot)) {
      return json({ error: "You do not have access to this lead." }, 403);
    }
    const input = await request.json();
    if (input.appointmentStatus && !["booked", "cancelled"].includes(input.appointmentStatus)) {
      return json({ error: "Invalid appointment status." }, 422);
    }
    if (input.handoffStatus && !HANDOFF_STATUSES.has(input.handoffStatus)) {
      return json({ error: "Invalid handoff status." }, 422);
    }
    const update: Record<string, any> = {
      notes: clean(input.notes, 20_000) || null,
      appointment_status: input.appointmentStatus || undefined,
      handoff_status: input.handoffStatus || undefined,
    };
    if (isManager) update.assigned_to = clean(input.assignedTo) || null;
    const { data, error } = await supabase.from("leads").update(update)
      .eq("id", leadMatch[1]).select().maybeSingle();
    if (error) throw error;
    return json(data);
  }

  if (request.method === "GET" && pathname === "/api/admin/seller-leads") {
    let query = supabase.from("seller_leads").select("*").order("created_at", { ascending: false });
    if (!isManager) query = query.eq("assigned_to", membership.email);
    const { data, error } = await query;
    if (error) throw error;
    const allPaths = [...new Set((data || []).flatMap((lead: Record<string, any>) => lead.media_paths || []))];
    const signed = new Map<string, string>();
    if (allPaths.length) {
      const { data: signedRows } = await supabase.storage.from(SELLER_MEDIA_BUCKET).createSignedUrls(allPaths, 900);
      (signedRows || []).forEach((item: Record<string, any>) => {
        if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
      });
    }
    return json((data || []).map((lead: Record<string, any>) => ({
      ...lead,
      media_urls: (lead.media_paths || []).map((path: string) => signed.get(path)).filter(Boolean),
    })));
  }

  const sellerMatch = pathname.match(/^\/api\/admin\/seller-leads\/(\d+)$/);
  if (request.method === "PATCH" && sellerMatch) {
    const input = await request.json();
    const update: Record<string, any> = {
      notes: clean(input.notes, 20_000) || null,
      status: clean(input.status, 40) || undefined,
      updated_at: new Date().toISOString(),
    };
    if (isManager) update.assigned_to = clean(input.assignedTo) || null;
    let query = supabase.from("seller_leads").update(update).eq("id", sellerMatch[1]);
    if (!isManager) query = query.eq("assigned_to", membership.email);
    const { data, error } = await query.select().maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "Seller lead not found." }, 404);
    return json(data);
  }

  if (!isManager) return json({ error: "Administrator access is required." }, 403);

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
      const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(
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
        await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
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
    if (request.method === "POST" && pathname === "/api/seller-leads") return withCors(await submitSellerLead(request, supabase));
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
