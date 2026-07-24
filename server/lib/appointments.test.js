import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { buildSlots, validateAppointmentTime } from "./appointments.js";

const zone = "America/Vancouver";
const now = DateTime.fromISO("2026-07-23T09:15:00", { zone });

describe("appointment slots", () => {
  it("returns 14 days of hourly slots and excludes booked lot times", () => {
    const booked = [DateTime.fromISO("2026-07-23T11:00:00", { zone }).toJSDate()];
    const slots = buildSlots(booked, zone, now);
    expect(new Set(slots.map((slot) => slot.dateLabel)).size).toBe(14);
    expect(slots.some((slot) => slot.dateLabel.includes("Jul 23") && slot.timeLabel === "11:00 AM")).toBe(false);
  });

  it("enforces business hours and the 14-day boundary", () => {
    expect(validateAppointmentTime("2026-07-24T10:00:00-07:00", zone, now).toISO())
      .toBe("2026-07-24T17:00:00.000Z");
    expect(() => validateAppointmentTime("2026-07-24T09:00:00-07:00", zone, now)).toThrow(/10:00 AM/);
    expect(() => validateAppointmentTime("2026-08-20T10:00:00-07:00", zone, now)).toThrow(/14 days/);
  });
});
