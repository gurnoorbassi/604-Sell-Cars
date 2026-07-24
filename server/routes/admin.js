import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { pool } from "../db.js";
import { config } from "../config.js";

export const adminRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024, files: 20 },
});

adminRouter.get("/leads", async (req, res, next) => {
  try {
    const result = await pool.query(
      `select l.*, c.year, c.make, c.model, c.trim, c.title, c.lot, c.lot_name, c.lot_address
       from leads l join cars c on c.id = l.car_id
       where ($1 = '' or c.lot = $1)
         and ($2 = '' or (l.appointment_time at time zone $3)::date = $2::date)
       order by l.created_at desc`,
      [String(req.query.lot || ""), String(req.query.date || ""), config.timezone],
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/leads/:id", async (req, res, next) => {
  try {
    const status = req.body.appointmentStatus;
    if (status && !["booked", "cancelled"].includes(status)) {
      return res.status(422).json({ error: "Invalid appointment status." });
    }
    const result = await pool.query(
      `update leads set assigned_to = $1, notes = $2,
       appointment_status = coalesce($3, appointment_status)
       where id = $4 returning *`,
      [req.body.assignedTo?.trim() || null, req.body.notes?.trim() || null, status || null, req.params.id],
    );
    if (!result.rowCount) return res.status(404).json({ error: "Lead not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/cars", async (_req, res, next) => {
  try {
    res.json((await pool.query("select * from cars order by updated_at desc")).rows);
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/lots", async (_req, res, next) => {
  try {
    res.json((await pool.query(
      `select distinct lot, lot_name from cars
       where lot <> 'LOCATION_REQUIRED' order by lot_name`,
    )).rows);
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/cars", saveCar);
adminRouter.put("/cars/:id", saveCar);

async function saveCar(req, res, next) {
  try {
    const car = req.body;
    for (const field of ["make", "model", "lot", "lotName", "lotAddress"]) {
      if (!String(car[field] || "").trim()) {
        return res.status(422).json({ error: `${field} is required.` });
      }
    }
    if (!["available", "sold"].includes(car.status)) {
      return res.status(422).json({ error: "Status must be available or sold." });
    }
    for (const [field, min] of [["year", 1900], ["price", 0], ["mileage", 0]]) {
      if (!Number.isFinite(Number(car[field])) || Number(car[field]) < min) {
        return res.status(422).json({ error: `${field} must be a valid number.` });
      }
    }
    const id = req.params.id || randomUUID();
    const title = `${car.year} ${car.make.trim()} ${car.model.trim()}${car.trim?.trim() ? ` ${car.trim.trim()}` : ""}`;
    const values = [
      id, title, car.stock?.trim() || "", String(car.price), String(car.mileage),
      car.lotName.trim(), car.bodyType?.trim() || "", car.fuelTags || [],
      car.labels || [], car.description?.trim() || "", car.carfaxUrl?.trim() || "",
      car.status, Number(car.year), car.make.trim(), car.model.trim(), car.trim?.trim() || null,
      Number(car.price), Number(car.mileage), car.lot.trim(), car.lotName.trim(),
      car.lotAddress.trim(), car.fuelType?.trim() || "", Boolean(car.featured),
    ];
    const result = await pool.query(
      `insert into cars (
        id, title, stock, price, kms, dealership, body_type, fuel_tags, labels,
        description, carfax_url, status, year, make, model, trim, price_amount,
        mileage, lot, lot_name, lot_address, fuel_type, featured
       ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
       )
       on conflict (id) do update set
        title=excluded.title, stock=excluded.stock, price=excluded.price, kms=excluded.kms,
        dealership=excluded.dealership, body_type=excluded.body_type, fuel_tags=excluded.fuel_tags,
        labels=excluded.labels, description=excluded.description, carfax_url=excluded.carfax_url,
        status=excluded.status, year=excluded.year, make=excluded.make, model=excluded.model,
        trim=excluded.trim, price_amount=excluded.price_amount, mileage=excluded.mileage,
        lot=excluded.lot, lot_name=excluded.lot_name, lot_address=excluded.lot_address,
        fuel_type=excluded.fuel_type, featured=excluded.featured, updated_at=now()
       returning *`,
      values,
    );
    res.status(req.params.id ? 200 : 201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

adminRouter.post("/cars/:id/media", upload.array("media", 20), async (req, res, next) => {
  try {
    const car = (await pool.query("select id, images, videos from cars where id = $1", [req.params.id])).rows[0];
    if (!car) return res.status(404).json({ error: "Vehicle not found." });
    const imageDir = path.resolve(config.uploadDir, "cars", car.id, "images");
    const videoDir = path.resolve(config.uploadDir, "cars", car.id, "videos");
    const thumbDir = path.resolve(config.uploadDir, "cars", car.id, "thumbs");
    await Promise.all([mkdir(imageDir, { recursive: true }), mkdir(videoDir, { recursive: true }), mkdir(thumbDir, { recursive: true })]);
    const images = [...(car.images || [])];
    const videos = [...(car.videos || [])];
    for (const file of req.files || []) {
      const stem = `${Date.now()}-${randomUUID()}`;
      if (file.mimetype.startsWith("image/")) {
        const filename = `${stem}.webp`;
        await Promise.all([
          sharp(file.buffer).rotate().resize({ width: 2200, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(imageDir, filename)),
          sharp(file.buffer).rotate().resize({ width: 520, height: 350, fit: "cover" }).webp({ quality: 76 }).toFile(path.join(thumbDir, filename)),
        ]);
        images.push(`/uploads/cars/${car.id}/images/${filename}`);
      } else if (file.mimetype.startsWith("video/")) {
        const extension = path.extname(file.originalname).toLowerCase() || ".mp4";
        const filename = `${stem}${extension}`;
        await writeFile(path.join(videoDir, filename), file.buffer);
        videos.push(`/uploads/cars/${car.id}/videos/${filename}`);
      }
    }
    const result = await pool.query(
      "update cars set images = $1, videos = $2, updated_at = now() where id = $3 returning images, videos",
      [images, videos, car.id],
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
