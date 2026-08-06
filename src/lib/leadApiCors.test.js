import { describe, expect, it } from "vitest";
import { CORS_METHODS } from "../../apps/lead-api/lib/cors";

describe("Lead API CORS methods", () => {
  it("allows the Lead Desk to send authenticated delete requests", () => {
    expect(CORS_METHODS.split(", ")).toContain("DELETE");
  });
});
