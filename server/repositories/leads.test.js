import { newDb } from "pg-mem";
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { upsertLead } from "./leads.js";

function database() {
  const memory = newDb();
  memory.public.none(`
    create table cars (
      id text primary key, year integer, make text, model text, trim text, title text,
      lot text not null, lot_name text not null, lot_address text not null, status text not null
    );
    create table leads (
      id bigserial primary key, name text not null, phone text not null unique, email text,
      car_id text not null references cars(id), budget numeric not null,
      appointment_time timestamptz not null, appointment_status text not null default 'booked',
      assigned_to text, notes text, reminder_24h_sent_at timestamptz,
      reminder_2h_sent_at timestamptz, created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
  `);
  const adapter = memory.adapters.createPg();
  const raw = new adapter.Pool();
  return {
    memory,
    db: {
      async connect() {
        const client = await raw.connect();
        return {
          release: () => client.release(),
          query: (sql, values) => String(sql).includes("pg_advisory_xact_lock")
            ? Promise.resolve({ rows: [], rowCount: 0 })
            : client.query(sql, values),
        };
      },
    },
  };
}

const appointment = (hour) => DateTime.now().setZone("America/Vancouver")
  .plus({ days: 1 }).startOf("day").set({ hour }).toISO();

describe("lead upsert", () => {
  it("keeps one row per normalized phone and updates the selected car", async () => {
    const { memory, db } = database();
    memory.public.none(`
      insert into cars values
      ('a', 2024, 'Toyota', 'RAV4', 'LE', '2024 Toyota RAV4', 'surrey', 'Surrey Lot', '123 Main St', 'available'),
      ('b', 2023, 'Honda', 'CR-V', 'EX', '2023 Honda CR-V', 'burnaby', 'Burnaby Lot', '456 Kingsway', 'available')
    `);
    const first = await upsertLead(db, { name: "Alex", phone: "(604) 555-0123", carId: "a", budget: 30000, appointmentTime: appointment(10) }, "America/Vancouver");
    const second = await upsertLead(db, { name: "Alex", phone: "+1 604 555 0123", carId: "b", budget: 35000, appointmentTime: appointment(11) }, "America/Vancouver");
    const rows = memory.public.many("select * from leads");
    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0].car_id).toBe("b");
  });

  it("prevents two phones from booking the same lot and time", async () => {
    const { memory, db } = database();
    memory.public.none(`
      insert into cars values
      ('a', 2024, 'Toyota', 'RAV4', 'LE', '2024 Toyota RAV4', 'surrey', 'Surrey Lot', '123 Main St', 'available'),
      ('b', 2024, 'Toyota', 'Camry', 'SE', '2024 Toyota Camry', 'surrey', 'Surrey Lot', '123 Main St', 'available')
    `);
    const time = appointment(12);
    await upsertLead(db, { name: "One", phone: "6045550101", carId: "a", budget: 30000, appointmentTime: time }, "America/Vancouver");
    await expect(upsertLead(db, { name: "Two", phone: "6045550102", carId: "b", budget: 30000, appointmentTime: time }, "America/Vancouver"))
      .rejects.toThrow(/just booked/);
  });
});
