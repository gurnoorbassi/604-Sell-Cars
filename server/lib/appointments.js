import { DateTime } from "luxon";

export const OPENING_HOUR = 10;
export const CLOSING_HOUR = 19;
export const DAYS_VISIBLE = 14;

export function validateAppointmentTime(value, timezone, now = DateTime.now()) {
  const appointment = DateTime.fromISO(String(value || ""), { setZone: true });
  if (!appointment.isValid) throw Object.assign(new Error("Choose a valid appointment time."), { status: 422 });
  const local = appointment.setZone(timezone);
  const localNow = now.setZone(timezone);
  const end = localNow.startOf("day").plus({ days: DAYS_VISIBLE - 1 }).endOf("day");
  if (local <= localNow) throw Object.assign(new Error("Appointment time must be in the future."), { status: 422 });
  if (local > end) throw Object.assign(new Error("Appointment must be within the next 14 days."), { status: 422 });
  if (local.minute || local.second || local.millisecond) {
    throw Object.assign(new Error("Appointments start on the hour."), { status: 422 });
  }
  if (local.hour < OPENING_HOUR || local.hour > CLOSING_HOUR) {
    throw Object.assign(new Error("Choose a time between 10:00 AM and 7:00 PM."), { status: 422 });
  }
  return local.toUTC();
}

export function buildSlots(bookedValues, timezone, now = DateTime.now()) {
  const booked = new Set(bookedValues.map((value) => DateTime.fromJSDate(new Date(value)).toUTC().toISO()));
  const localNow = now.setZone(timezone);
  const slots = [];
  for (let day = 0; day < DAYS_VISIBLE; day += 1) {
    const date = localNow.startOf("day").plus({ days: day });
    for (let hour = OPENING_HOUR; hour <= CLOSING_HOUR; hour += 1) {
      const local = date.set({ hour });
      const iso = local.toUTC().toISO();
      if (local > localNow && !booked.has(iso)) {
        slots.push({ iso, dateLabel: local.toFormat("ccc, LLL d"), timeLabel: local.toFormat("h:mm a") });
      }
    }
  }
  return slots;
}
