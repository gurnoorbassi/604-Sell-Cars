import { describe, expect, it } from "vitest";
import { buildSubmissionMessages } from "./sms.js";

describe("Twilio copy", () => {
  it("contains the derived lot, vehicle, lead, and appointment", () => {
    const result = buildSubmissionMessages({
      isNew: true,
      lead: { name: "Alex", phone: "+16045550123", appointment_time: new Date("2026-07-24T17:00:00Z") },
      car: { year: 2024, make: "Toyota", model: "RAV4", trim: "LE", lot_name: "Surrey Lot", lot_address: "123 Main Street, Surrey, BC" },
    });
    expect(result.admin).toContain("NEW LEAD");
    expect(result.admin).toContain("Alex — +16045550123");
    expect(result.admin).toContain("Surrey Lot");
    expect(result.lead).toContain("123 Main Street");
    expect(result.lead).toContain("10:00 AM");
  });
});
