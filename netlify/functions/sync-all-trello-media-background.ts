import { createClient } from "@supabase/supabase-js";
import type { Context } from "@netlify/functions";

const SUPABASE_URL = "https://uduartuijwldxhgpmwks.supabase.co";
const DISPATCH_CONCURRENCY = 5;
const DISPATCH_PAUSE_MS = 250;

type CarRow = {
  id: string;
  trello_url: string;
  photo_count: number;
  vehicle_media?: Array<{ kind: string }>;
};

const pause = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export default async (request: Request, _context: Context) => {
  if (request.method !== "POST") return;

  const publishableKey = Netlify.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    || request.headers.get("x-supabase-publishable-key");
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!publishableKey || !token) {
    console.error("Bulk gallery sync is missing its authentication configuration.");
    return;
  }

  const supabase = createClient(SUPABASE_URL, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user?.email) {
    console.error("Bulk gallery sync request did not contain a valid session.");
    return;
  }
  const { data: membership } = await supabase
    .from("team_members")
    .select("role, active")
    .eq("email", userData.user.email.toLowerCase())
    .eq("active", true)
    .maybeSingle();
  if (membership?.role !== "owner") {
    console.error("Only the inventory owner can sync every Trello gallery.");
    return;
  }

  const { data, error } = await supabase
    .from("cars")
    .select("id, trello_url, photo_count, vehicle_media(kind)")
    .neq("trello_url", "");
  if (error) {
    console.error(`Bulk gallery sync could not load inventory: ${error.message}`);
    return;
  }

  const incompleteCars = ((data || []) as CarRow[]).filter((car) => {
    const imageCount = (car.vehicle_media || []).filter((item) => item.kind === "image").length;
    return Boolean(car.trello_url) && imageCount < Number(car.photo_count || 0);
  });
  const origin = new URL(request.url).origin;
  let queued = 0;
  let failed = 0;

  const dispatch = async (car: CarRow) => {
    try {
      const response = await fetch(`${origin}/.netlify/functions/sync-trello-card-media-background`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authorization,
          "x-supabase-publishable-key": publishableKey,
        },
        body: JSON.stringify({ vehicleId: car.id }),
      });
      if (!response.ok && response.status !== 202) {
        throw new Error(`HTTP ${response.status}`);
      }
      queued += 1;
    } catch (dispatchError) {
      failed += 1;
      const message = dispatchError instanceof Error ? dispatchError.message : "Unknown dispatch error";
      console.warn(`Vehicle ${car.id} could not be queued: ${message}`);
    }
  };

  for (let index = 0; index < incompleteCars.length; index += DISPATCH_CONCURRENCY) {
    await Promise.all(incompleteCars.slice(index, index + DISPATCH_CONCURRENCY).map(dispatch));
    if (index + DISPATCH_CONCURRENCY < incompleteCars.length) await pause(DISPATCH_PAUSE_MS);
  }

  console.log(JSON.stringify({
    discovered: data?.length || 0,
    incomplete: incompleteCars.length,
    queued,
    failed,
  }));
};
