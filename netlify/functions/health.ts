import type { Config, Context } from "@netlify/functions";

export default async (_request: Request, _context: Context) => {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch("https://uduartuijwldxhgpmwks.supabase.co/auth/v1/health", {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Supabase Auth returned ${response.status}`);
    return Response.json(
      { status: "ok", checkedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "degraded", checkedAt },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
};

export const config: Config = {
  path: "/api/health",
};
