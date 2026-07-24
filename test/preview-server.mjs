import express from "express";
import { DateTime } from "luxon";
import path from "node:path";

const app = express();
const zone = "America/Vancouver";
const cars = [
  {
    id: "rav4", year: 2024, make: "Toyota", model: "RAV4", trim: "LE",
    title: "2024 Toyota RAV4 LE", stock: "604-101", price_amount: 34990,
    mileage: 18200, body_type: "SUV", fuel_type: "Gasoline",
    fuel_tags: ["Gasoline", "AWD"], labels: ["NEW ARRIVAL"], featured: true,
    lot: "surrey-main", lot_name: "604 Sell Cars Surrey",
    lot_address: "123 King George Boulevard, Surrey, BC V3T 2W1",
    status: "available", images: [], videos: [], media: [],
    description: "Well-equipped compact SUV with all-wheel drive.",
    carfax_url: "https://example.com/carfax",
    updated_at: new Date().toISOString(),
  },
  {
    id: "civic", year: 2023, make: "Honda", model: "Civic", trim: "Sport",
    title: "2023 Honda Civic Sport", stock: "604-102", price_amount: 28990,
    mileage: 24000, body_type: "Sedan", fuel_type: "Gasoline",
    fuel_tags: ["Gasoline"], labels: ["HOT SELL"], featured: false,
    lot: "burnaby", lot_name: "604 Sell Cars Burnaby",
    lot_address: "456 Kingsway, Burnaby, BC V5H 2E8",
    status: "available", images: [], videos: [], media: [],
    description: "Sport trim sedan with practical fuel economy.",
    updated_at: new Date().toISOString(),
  },
];
const sampleLead = {
  id: 1, name: "Alex Driver", phone: "+16045550123", email: "alex@example.com",
  car_id: "rav4", budget: 35000, appointment_time: DateTime.now().plus({ days: 1 }).toISO(),
  appointment_status: "booked", assigned_to: "Jordan", notes: "Asked about winter tires.",
  reminder_24h_sent_at: null, reminder_2h_sent_at: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  ...cars[0],
};
app.use(express.json());
app.use(express.static(path.resolve("dist")));
app.get("/api/config", (_req, res) => res.json({ metaPixelId: "", timezone: zone }));
app.get("/api/cars", (_req, res) => res.json(cars));
app.get("/api/cars/:id", (req, res) => res.json(cars.find((car) => car.id === req.params.id)));
app.get("/api/cars/:id/slots", (req, res) => {
  const base = DateTime.now().setZone(zone).plus({ days: 1 }).startOf("day");
  res.json({ car: cars.find((car) => car.id === req.params.id), timezone: zone,
    slots: [10, 11, 12, 13, 14].map((hour) => ({
      iso: base.set({ hour }).toUTC().toISO(), dateLabel: base.toFormat("ccc, LLL d"),
      timeLabel: base.set({ hour }).toFormat("h:mm a"),
    })) });
});
app.get("/api/filters", (_req, res) => res.json({
  lots: ["surrey-main", "burnaby"], body_types: ["SUV", "Sedan"],
  fuel_types: ["Gasoline"], makes: ["Toyota", "Honda"], years: [2024, 2023],
}));
app.post("/api/leads", (req, res) => res.status(201).json({
  isNew: true, lead: { id: 1, name: req.body.name, appointmentTime: req.body.appointmentTime },
  car: { id: cars[0].id, name: cars[0].title, lotName: cars[0].lot_name, lotAddress: cars[0].lot_address },
}));
app.get("/api/admin/lots", (_req, res) => res.json(cars.map((car) => ({ lot: car.lot, lot_name: car.lot_name }))));
app.get("/api/admin/leads", (_req, res) => res.json([sampleLead]));
app.get("/api/admin/cars", (_req, res) => res.json(cars));
app.patch("/api/admin/leads/:id", (req, res) => res.json({ ...sampleLead, ...req.body }));
app.post("/api/admin/cars", (req, res) => res.status(201).json({ id: "new", ...req.body }));
app.put("/api/admin/cars/:id", (req, res) => res.json({ id: req.params.id, ...req.body }));
app.post("/api/admin/cars/:id/media", (_req, res) => res.json({ images: [], videos: [] }));
app.get(/.*/, (_req, res) => res.sendFile(path.resolve("dist", "index.html")));
app.listen(4173, "127.0.0.1", () => console.log("Preview at http://127.0.0.1:4173"));
