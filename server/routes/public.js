import { Router } from "express";
import { DateTime } from "luxon";
import { pool } from "../db.js";
import { config } from "../config.js";
import { buildSlots } from "../lib/appointments.js";
import { upsertLead } from "../repositories/leads.js";
import { sendSubmissionMessages } from "../services/sms.js";

export const publicRouter = Router();

const mediaSql = `coalesce((
  select json_agg(json_build_object(
    'kind', vm.kind, 'source_url', vm.source_url, 'storage_path', vm.storage_path,
    'sort_order', vm.sort_order
  ) order by vm.sort_order)
  from vehicle_media vm where vm.vehicle_id = c.id
), '[]'::json) as media`;

publicRouter.get("/config", (_req, res) => res.json({
  metaPixelId: config.metaPixelId,
  timezone: config.timezone,
}));

publicRouter.get("/cars", async (req, res, next) => {
  try {
    const search = String(req.query.search || req.query.q || "").trim();
    const lot = String(req.query.lot || "");
    const bodyType = String(req.query.bodyType || "");
    const fuel = String(req.query.fuel || "");
    const make = String(req.query.make || "");
    const year = String(req.query.year || "");
    const minPrice = String(req.query.minPrice || "");
    const maxPrice = String(req.query.maxPrice || "");
    const sorts = {
      newest: "c.updated_at desc",
      price_asc: "c.price_amount asc nulls last",
      price_desc: "c.price_amount desc nulls last",
      mileage: "c.mileage asc nulls last",
    };
    const orderBy = sorts[req.query.sort] || "c.featured desc, c.updated_at desc";
    const result = await pool.query(
      `select c.*, ${mediaSql}
       from cars c
       where c.status = 'available'
         and c.lot <> 'LOCATION_REQUIRED' and c.lot_address <> 'ADDRESS REQUIRED'
         and ($1 = '' or concat_ws(' ', c.year, c.make, c.model, c.trim, c.title, c.stock) ilike '%' || $1 || '%')
         and ($2 = '' or c.lot = $2)
         and ($3 = '' or c.body_type = $3)
         and ($4 = '' or c.fuel_type = $4 or $4 = any(c.fuel_tags))
         and ($5 = '' or c.make = $5)
         and ($6 = '' or c.year = nullif($6, '')::integer)
         and ($7 = '' or c.price_amount >= nullif($7, '')::numeric)
         and ($8 = '' or c.price_amount <= nullif($8, '')::numeric)
       order by ${orderBy}
       limit 500`,
      [search, lot, bodyType, fuel, make, year, minPrice, maxPrice],
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/cars/:id", async (req, res, next) => {
  try {
    const result = await pool.query(
      `select c.*, ${mediaSql} from cars c
       where c.id = $1 and c.status = 'available'
         and c.lot <> 'LOCATION_REQUIRED' and c.lot_address <> 'ADDRESS REQUIRED'`,
      [req.params.id],
    );
    if (!result.rowCount) return res.status(404).json({ error: "Vehicle not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/cars/:id/slots", async (req, res, next) => {
  try {
    const carResult = await pool.query(
      `select id, lot, lot_name, lot_address from cars
       where id = $1 and status = 'available'
         and lot <> 'LOCATION_REQUIRED' and lot_address <> 'ADDRESS REQUIRED'`,
      [req.params.id],
    );
    if (!carResult.rowCount) return res.status(404).json({ error: "Vehicle unavailable or missing location." });
    const car = carResult.rows[0];
    const end = DateTime.now().setZone(config.timezone).endOf("day").plus({ days: 13 }).toUTC();
    const booked = await pool.query(
      `select l.appointment_time from leads l join cars c on c.id = l.car_id
       where c.lot = $1 and l.appointment_status = 'booked'
         and l.appointment_time > now() and l.appointment_time <= $2`,
      [car.lot, end.toISO()],
    );
    res.json({
      car,
      timezone: config.timezone,
      slots: buildSlots(booked.rows.map((row) => row.appointment_time), config.timezone),
    });
  } catch (error) {
    next(error);
  }
});

publicRouter.post("/leads", async (req, res, next) => {
  try {
    const { name, phone, email, carId, budget, appointmentTime } = req.body;
    if (!String(name || "").trim()) return res.status(422).json({ error: "Name is required." });
    if (!carId) return res.status(422).json({ error: "Choose a vehicle." });
    if (budget === "" || !Number.isFinite(Number(budget)) || Number(budget) < 0) {
      return res.status(422).json({ error: "Enter a valid budget." });
    }
    const result = await upsertLead(
      pool,
      { name, phone, email, carId, budget, appointmentTime },
      config.timezone,
    );
    void sendSubmissionMessages(result);
    res.status(result.isNew ? 201 : 200).json({
      isNew: result.isNew,
      lead: { id: result.lead.id, name: result.lead.name, appointmentTime: result.lead.appointment_time },
      car: {
        id: result.car.id,
        name: [result.car.year, result.car.make, result.car.model, result.car.trim].filter(Boolean).join(" ")
          || result.car.title,
        lotName: result.car.lot_name,
        lotAddress: result.car.lot_address,
      },
    });
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/filters", async (_req, res, next) => {
  try {
    const result = await pool.query(
      `select
        array_remove(array_agg(distinct lot order by lot), null) lots,
        array_remove(array_agg(distinct body_type order by body_type), null) body_types,
        array_remove(array_agg(distinct fuel_type order by fuel_type), null) fuel_types,
        array_remove(array_agg(distinct make order by make), null) makes,
        array_remove(array_agg(distinct year order by year desc), null) years
       from cars where status = 'available' and lot <> 'LOCATION_REQUIRED'`,
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
