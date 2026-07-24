import React, { useEffect, useMemo, useState } from "react";
import { api, carName } from "../lib/api";

export default function BookingForm({ initialCarId = "", compact = false }) {
  const [cars, setCars] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [slots, setSlots] = useState([]);
  const [date, setDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    api(`/api/cars?search=${encodeURIComponent(search)}`)
      .then((rows) => {
        setCars(rows.slice(0, 30));
        if (initialCarId && !selected) {
          const match = rows.find((car) => String(car.id) === String(initialCarId));
          if (match) chooseCar(match);
          else api(`/api/cars/${encodeURIComponent(initialCarId)}`).then(chooseCar).catch(() => {});
        }
      })
      .catch((requestError) => setError(requestError.message));
  }, [search, initialCarId]);

  useEffect(() => {
    api("/api/config").then(({ metaPixelId }) => {
      if (!metaPixelId || window.fbq) return;
      const script = document.createElement("script");
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      script.async = true;
      document.head.appendChild(script);
      window.fbq = function pixelQueue() {
        window.fbq.callMethod ? window.fbq.callMethod(...arguments) : window.fbq.queue.push(arguments);
      };
      window.fbq.queue = [];
      window.fbq.loaded = true;
      window.fbq.version = "2.0";
      window.fbq("init", metaPixelId);
      window.fbq("track", "PageView");
    }).catch(() => {});
  }, []);

  const groups = useMemo(() => slots.reduce((map, slot) => {
    if (!map.has(slot.dateLabel)) map.set(slot.dateLabel, []);
    map.get(slot.dateLabel).push(slot);
    return map;
  }, new Map()), [slots]);

  async function chooseCar(car) {
    setSelected(car);
    setSearch(carName(car));
    setError("");
    setAppointmentTime("");
    try {
      const data = await api(`/api/cars/${encodeURIComponent(car.id)}/slots`);
      setSlots(data.slots);
      setDate(data.slots[0]?.dateLabel || "");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!selected) return setError("Choose a vehicle from the available inventory.");
    if (!appointmentTime) return setError("Choose an available appointment time.");
    setSubmitting(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, carId: selected.id, appointmentTime }),
      });
      setConfirmation(result);
      if (window.fbq) window.fbq("track", "Lead", { content_ids: [selected.id], content_name: carName(selected) });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <section className="bg-white p-7 text-neutral-950 shadow-2xl sm:p-10">
        <p className="text-xs font-black uppercase tracking-[.2em] text-red-600">Appointment confirmed</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight">We’ll see you there.</h2>
        <p className="mt-3 text-neutral-600">{confirmation.lead.name}, your viewing is booked.</p>
        <div className="mt-7 grid gap-px bg-neutral-200 sm:grid-cols-3">
          <div className="bg-neutral-50 p-4"><small>Vehicle</small><strong className="block">{confirmation.car.name}</strong></div>
          <div className="bg-neutral-50 p-4"><small>Time</small><strong className="block">{new Date(confirmation.lead.appointmentTime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</strong></div>
          <div className="bg-neutral-50 p-4"><small>Location</small><strong className="block">{confirmation.car.lotName}</strong><span>{confirmation.car.lotAddress}</span></div>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className={`bg-white text-neutral-950 shadow-2xl ${compact ? "p-5" : "p-7 sm:p-10"}`}>
      <div className="mb-7 border-b border-neutral-200 pb-5">
        <p className="text-xs font-black uppercase tracking-[.2em] text-red-600">Reserve your visit</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Pick the car. Choose your time.</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold uppercase tracking-wide">Name
          <input className="mt-2 w-full border border-neutral-300 p-3 text-base" name="name" autoComplete="name" required />
        </label>
        <label className="text-xs font-bold uppercase tracking-wide">Phone
          <input className="mt-2 w-full border border-neutral-300 p-3 text-base" name="phone" type="tel" autoComplete="tel" required />
        </label>
      </div>
      <label className="relative mt-4 block text-xs font-bold uppercase tracking-wide">Car you want
        <input className="mt-2 w-full border border-neutral-300 p-3 text-base" value={search}
          onChange={(event) => { setSearch(event.target.value); setSelected(null); }} placeholder="Search year, make, model, or stock" />
        {!selected && search && (
          <div className="absolute z-20 max-h-64 w-full overflow-auto border border-neutral-200 bg-white shadow-xl">
            {cars.map((car) => (
              <button type="button" key={car.id} onClick={() => chooseCar(car)}
                className="block w-full border-b border-neutral-100 p-3 text-left hover:bg-neutral-50">
                <strong className="block">{carName(car)}</strong>
                <span className="normal-case text-neutral-500">${Number(car.price_amount || 0).toLocaleString()} · {car.lot_name}</span>
              </button>
            ))}
          </div>
        )}
      </label>
      {selected && <p className="mt-2 text-sm text-neutral-500">Appointment location is automatically set from this car’s lot.</p>}
      <label className="mt-4 block text-xs font-bold uppercase tracking-wide">Budget
        <input className="mt-2 w-full border border-neutral-300 p-3 text-base" name="budget" type="number" min="0" step="500" required />
      </label>
      <fieldset className="mt-5" disabled={!selected}>
        <legend className="text-xs font-bold uppercase tracking-wide">Appointment time</legend>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
          {[...groups.keys()].map((label) => (
            <button type="button" key={label} onClick={() => setDate(label)}
              className={`shrink-0 border px-3 py-2 text-sm ${date === label ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-300"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(groups.get(date) || []).map((slot) => (
            <button type="button" key={slot.iso} onClick={() => setAppointmentTime(slot.iso)}
              className={`border p-2 text-sm ${appointmentTime === slot.iso ? "border-red-600 bg-red-600 text-white" : "border-neutral-300"}`}>
              {slot.timeLabel}
            </button>
          ))}
        </div>
      </fieldset>
      {error && <p className="mt-4 border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button disabled={submitting} className="mt-6 flex w-full justify-between bg-red-600 p-4 font-black uppercase tracking-wide text-white disabled:opacity-60">
        <span>{submitting ? "Booking…" : "Book my appointment"}</span><span>→</span>
      </button>
    </form>
  );
}
