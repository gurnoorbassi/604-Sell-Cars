import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronRight, Clock3, LockKeyhole, MapPin, Search } from "lucide-react";
import { api, carName, priceLabel } from "../lib/api";

export default function BookingForm({ initialCarId = "", compact = false }) {
  const [cars, setCars] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [slots, setSlots] = useState([]);
  const [date, setDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [budget, setBudget] = useState(30000);
  const [budgetTouched, setBudgetTouched] = useState(false);
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
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setSelected(car);
    setSearch(carName(car));
    if (!budgetTouched && Number.isFinite(Number(car.price_amount))) {
      const suggestedBudget = Math.ceil(Number(car.price_amount) / 5000) * 5000;
      setBudget(Math.min(250000, Math.max(5000, suggestedBudget)));
    }
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
      <section className="overflow-hidden border border-neutral-200 bg-white text-neutral-950 shadow-[0_20px_60px_rgba(0,0,0,.16)]">
        <div className="bg-green-700 p-7 text-white sm:p-9">
          <CheckCircle2 size={40} />
          <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-green-100">Appointment confirmed</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">You’re booked, {confirmation.lead.name}.</h2>
          <p className="mt-2 text-green-100">Your viewing details are confirmed below.</p>
        </div>
        <div className="grid gap-px bg-neutral-200 sm:grid-cols-3">
          <ConfirmationItem label="Vehicle" value={confirmation.car.name} />
          <ConfirmationItem label="Appointment" value={new Date(confirmation.lead.appointmentTime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} />
          <ConfirmationItem label="Location" value={confirmation.car.lotName} detail={confirmation.car.lotAddress} />
        </div>
      </section>
    );
  }

  const fieldClass = "mobile-form-control mt-2 h-12 min-w-0 w-full max-w-full rounded-md border border-neutral-300 bg-white px-3 text-base font-normal normal-case outline-none transition focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10";

  return (
    <form onSubmit={submit} className={`w-full min-w-0 max-w-full overflow-x-hidden border border-neutral-200 bg-white text-neutral-950 shadow-[0_20px_60px_rgba(0,0,0,.14)] ${compact ? "p-4 sm:p-7" : "p-4 sm:p-9"}`}>
      <div className="mb-7 flex items-start justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-red-600">Reserve your visit</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-.03em] sm:text-3xl">Choose your vehicle and time</h2>
          <p className="mt-2 text-sm text-neutral-500">Takes about two minutes. No account required.</p>
        </div>
        <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-full bg-red-50 text-red-600 sm:grid"><CalendarDays size={21} /></span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold uppercase tracking-[.08em] text-neutral-700">Full name
          <input className={fieldClass} name="name" autoComplete="name" placeholder="Your name" required />
        </label>
        <label className="text-xs font-bold uppercase tracking-[.08em] text-neutral-700">Phone number
          <input className={fieldClass} name="phone" type="tel" autoComplete="tel" placeholder="(604) 555-0123" required />
        </label>
      </div>

      <label className="relative mt-4 block min-w-0 max-w-full text-xs font-bold uppercase tracking-[.08em] text-neutral-700">Vehicle
        <div className="relative">
          <Search size={17} className="absolute left-3 top-1/2 mt-1 -translate-y-1/2 text-neutral-400" />
          <input className={`${fieldClass} pl-10`} value={search}
            onChange={(event) => { setSearch(event.target.value); setSelected(null); }}
            placeholder="Search year, make, or model" autoComplete="off" />
        </div>
        {!selected && search && (
          <div className="absolute z-20 mt-1 max-h-72 w-full max-w-full overflow-auto overscroll-contain rounded-lg border border-neutral-200 bg-white p-1 shadow-2xl">
            {cars.length ? cars.map((car) => (
              <button type="button" key={car.id} onClick={() => chooseCar(car)}
                className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md border-b border-neutral-100 p-3 text-left normal-case transition last:border-0 hover:bg-neutral-50">
                <span className="min-w-0"><strong className="block break-words text-sm leading-5">{carName(car)}</strong><span className="mt-1 block truncate text-xs text-neutral-500">{priceLabel(car)} · {car.lot_name}</span></span>
                <ChevronRight size={17} className="shrink-0 text-neutral-400" />
              </button>
            )) : <p className="p-4 text-center text-sm font-normal normal-case text-neutral-500">No matching vehicles found.</p>}
          </div>
        )}
      </label>

      {selected && (
        <div className="mt-3 flex gap-3 rounded-lg bg-neutral-950 p-4 text-white">
          <MapPin size={18} className="mt-0.5 shrink-0 text-red-400" />
          <div className="min-w-0"><small className="font-bold uppercase tracking-[.12em] text-neutral-400">Your viewing location</small><strong className="mt-1 block break-words">{selected.lot_name}</strong><span className="mt-0.5 block break-words text-sm text-neutral-300">{selected.lot_address}</span></div>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold uppercase tracking-[.08em] text-neutral-700">Email <span className="font-medium normal-case text-neutral-400">(optional)</span>
          <input className={fieldClass} name="email" type="email" autoComplete="email" placeholder="you@example.com" />
        </label>
        <div className="rounded-md border border-neutral-300 bg-neutral-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="budget-range" className="text-xs font-bold uppercase tracking-[.08em] text-neutral-700">Approximate budget</label>
            <output htmlFor="budget-range" className="text-lg font-black tabular-nums text-neutral-950">
              ${budget.toLocaleString()}
            </output>
          </div>
          <input
            id="budget-range"
            className="budget-range mt-4 w-full"
            type="range"
            min="5000"
            max="250000"
            step="1000"
            value={budget}
            style={{ "--budget-progress": `${((budget - 5000) / 245000) * 100}%` }}
            onChange={(event) => {
              setBudget(Number(event.target.value));
              setBudgetTouched(true);
            }}
          />
          <input type="hidden" name="budget" value={budget} />
          <div className="mt-2 flex justify-between text-[11px] font-semibold normal-case text-neutral-400">
            <span>$5k</span>
            <span>$250k+</span>
          </div>
        </div>
      </div>

      <fieldset className="mt-6 min-w-0 w-full max-w-full" disabled={!selected}>
        <legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.08em] text-neutral-700"><Clock3 size={15} /> Appointment time</legend>
        <div className="mobile-slot-scroll mt-3 flex w-full min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-2">
          {[...groups.keys()].map((label) => (
            <button type="button" key={label} onClick={() => setDate(label)}
              className={`shrink-0 rounded-md border px-3 py-2.5 text-sm font-bold transition ${date === label ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-300 bg-white hover:border-neutral-500"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-5">
          {(groups.get(date) || []).map((slot) => (
            <button type="button" key={slot.iso} onClick={() => setAppointmentTime(slot.iso)}
              className={`rounded-md border p-2.5 text-sm font-bold transition ${appointmentTime === slot.iso ? "border-red-600 bg-red-600 text-white" : "border-neutral-300 hover:border-red-400"}`}>
              {slot.timeLabel}
            </button>
          ))}
        </div>
        {!selected && <p className="mt-3 rounded-md bg-neutral-100 p-3 text-sm font-normal normal-case text-neutral-500">Choose a vehicle to see its available appointment times.</p>}
      </fieldset>

      {error && <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold normal-case text-red-800">{error}</p>}
      <button disabled={submitting} className="mt-6 flex w-full items-center justify-center gap-3 rounded-md bg-red-600 p-4 font-black text-white transition hover:bg-red-700 disabled:opacity-60">
        <span>{submitting ? "Confirming appointment…" : "Confirm my viewing"}</span><ChevronRight size={18} />
      </button>
      <p className="mt-4 flex items-start justify-center gap-2 text-center text-xs font-medium leading-5 normal-case text-neutral-500"><LockKeyhole size={13} className="mt-0.5 shrink-0" /> Your information is used only to coordinate this viewing.</p>
    </form>
  );
}

function ConfirmationItem({ label, value, detail }) {
  return <div className="bg-white p-5"><small className="font-bold uppercase tracking-[.12em] text-neutral-500">{label}</small><strong className="mt-2 block leading-snug">{value}</strong>{detail && <span className="mt-1 block text-sm text-neutral-600">{detail}</span>}</div>;
}
