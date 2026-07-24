import cron from "node-cron";
import { pool } from "../db.js";
import { config } from "../config.js";
import { formatAppointment, sendSms } from "./sms.js";

const message = (row, label) => [
  `Reminder: your ${label} appointment for the ${[row.year, row.make, row.model].filter(Boolean).join(" ") || row.title} is ${formatAppointment(row.appointment_time)}.`,
  row.lot_name,
  row.lot_address,
  "Reply or call us if you need to make a change.",
].join("\n");

async function claim(db, column, interval, lower = "0 hours") {
  return (await db.query(
    `update leads l set ${column} = now() from cars c
     where l.car_id = c.id and l.appointment_status = 'booked'
       and l.${column} is null and l.appointment_time > now() + $2::interval
       and l.appointment_time <= now() + $1::interval
     returning l.id, l.phone, l.appointment_time, c.year, c.make, c.model, c.title,
       c.lot_name, c.lot_address`,
    [interval, lower],
  )).rows;
}

export async function runReminderCycle({ db = pool, sender = sendSms } = {}) {
  for (const [column, interval, lower, label] of [
    ["reminder_24h_sent_at", "24 hours", "2 hours", "24-hour"],
    ["reminder_2h_sent_at", "2 hours", "0 hours", "2-hour"],
  ]) {
    const rows = await claim(db, column, interval, lower);
    for (const row of rows) {
      try {
        await sender(row.phone, message(row, label));
      } catch (error) {
        console.error(`${label} reminder failed`, error);
        await db.query(`update leads set ${column} = null where id = $1`, [row.id]);
      }
    }
  }
}

export const startReminderJob = () => cron.schedule(
  "*/5 * * * *",
  () => runReminderCycle().catch((error) => console.error("Reminder cycle failed", error)),
  { timezone: config.timezone },
);
