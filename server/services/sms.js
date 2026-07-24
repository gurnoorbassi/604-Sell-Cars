import twilio from "twilio";
import { DateTime } from "luxon";
import { config } from "../config.js";

let client;
const vehicleName = (car) => [car.year, car.make, car.model, car.trim].filter(Boolean).join(" ") || car.title;
export const formatAppointment = (value) =>
  DateTime.fromJSDate(new Date(value)).setZone(config.timezone).toFormat("ccc, LLL d 'at' h:mm a");

export function buildSubmissionMessages({ lead, car, isNew }) {
  const vehicle = vehicleName(car);
  const when = formatAppointment(lead.appointment_time);
  return {
    admin: [`🚗 ${isNew ? "NEW LEAD" : "LEAD UPDATED"}`, `${lead.name} — ${lead.phone}`, vehicle,
      `📍 ${car.lot_name}`, `🗓 ${when}`].join("\n"),
    lead: [`Hi ${lead.name}, your appointment for the ${vehicle} is confirmed.`, when,
      car.lot_name, car.lot_address, "Reply or call us if you need to make a change."].join("\n"),
  };
}

export async function sendSms(to, body) {
  if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioPhoneNumber) {
    if (config.nodeEnv !== "test") console.warn("Twilio is not configured; SMS skipped.");
    return { skipped: true };
  }
  client ||= twilio(config.twilioAccountSid, config.twilioAuthToken);
  return client.messages.create({ from: config.twilioPhoneNumber, to, body });
}

export async function sendSubmissionMessages(payload) {
  const messages = buildSubmissionMessages(payload);
  const sends = [sendSms(config.adminNotifyNumber, messages.admin), sendSms(payload.lead.phone, messages.lead)];
  (await Promise.allSettled(sends)).forEach((result) => {
    if (result.status === "rejected") console.error("Submission SMS failed", result.reason);
  });
}
