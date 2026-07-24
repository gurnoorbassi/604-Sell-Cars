import { normalizePhone } from "../lib/phone.js";
import { validateAppointmentTime } from "../lib/appointments.js";

export async function upsertLead(db, input, timezone) {
  const phone = normalizePhone(input.phone);
  const appointment = validateAppointmentTime(input.appointmentTime, timezone);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const carResult = await client.query(
      `select id, year, make, model, trim, title, lot, lot_name, lot_address, status
       from cars where id = $1 for share`,
      [input.carId],
    );
    const car = carResult.rows[0];
    if (!car || car.status !== "available") {
      throw Object.assign(new Error("That vehicle is no longer available."), { status: 409 });
    }
    if (!car.lot || !car.lot_name || !car.lot_address
        || car.lot === "LOCATION_REQUIRED" || car.lot_address === "ADDRESS REQUIRED") {
      throw Object.assign(new Error("This vehicle needs its lot information corrected before booking."), { status: 422 });
    }
    await client.query(
      `select pg_advisory_xact_lock(hashtext($1), floor(extract(epoch from $2::timestamptz))::integer)`,
      [car.lot, appointment.toISO()],
    );
    const conflict = await client.query(
      `select l.id from leads l join cars c on c.id = l.car_id
       where c.lot = $1 and l.appointment_time = $2
         and l.appointment_status = 'booked' and l.phone <> $3 limit 1`,
      [car.lot, appointment.toISO(), phone],
    );
    if (conflict.rowCount) {
      throw Object.assign(new Error("That time was just booked. Please choose another."), { status: 409 });
    }
    const existing = await client.query("select id from leads where phone = $1", [phone]);
    const result = await client.query(
      `insert into leads (name, phone, email, car_id, budget, appointment_time)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (phone) do update set
         name = excluded.name, email = excluded.email, car_id = excluded.car_id,
         budget = excluded.budget, appointment_time = excluded.appointment_time,
         appointment_status = 'booked', reminder_24h_sent_at = null,
         reminder_2h_sent_at = null
       returning *`,
      [String(input.name).trim(), phone, input.email?.trim() || null, car.id, input.budget, appointment.toISO()],
    );
    await client.query("COMMIT");
    return { lead: result.rows[0], car, isNew: !existing.rowCount };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
