import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, CheckCircle2, ChevronRight, Clock3, LockKeyhole,
  MapPin, Search, ShieldCheck,
} from "lucide-react";
import { api, carName, priceLabel } from "../lib/api";

const CREDIT_OPTIONS = [
  "Excellent (750+)",
  "Good (680–749)",
  "Fair (600–679)",
  "Rebuilding (under 600)",
  "Not sure",
];

export default function BookingForm({ initialCarId = "", compact = false }) {
  const [cars, setCars] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [slots, setSlots] = useState([]);
  const [date, setDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [budget, setBudget] = useState(30000);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    let active = true;
    api(`/api/cars?search=${encodeURIComponent(search)}`)
      .then(async (rows) => {
        if (!active) return;
        setCars(rows.slice(0, 30));
        if (initialCarId && !selected) {
          const match = rows.find((car) => String(car.id) === String(initialCarId))
            || await api(`/api/cars/${encodeURIComponent(initialCarId)}`);
          if (active && match) chooseCar(match);
        }
      })
      .catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
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
    const vehiclePrice = Number(car.price_amount);
    if (Number.isFinite(vehiclePrice) && vehiclePrice > 0) {
      setBudget(Math.min(250000, Math.max(5000, Math.ceil(vehiclePrice / 5000) * 5000)));
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
    if (!appointmentTime) return setError("Choose an available viewing time.");
    setSubmitting(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, carId: selected.id, appointmentTime, budget }),
      });
      setConfirmation(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (window.fbq) window.fbq("track", "Lead", { content_ids: [selected.id], content_name: carName(selected) });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <section className="overflow-hidden border border-white/10 bg-[#111418] text-white shadow-[0_28px_90px_rgba(0,0,0,.48)]">
        <div className="border-b border-emerald-400/20 bg-emerald-400/10 p-6 sm:p-9">
          <CheckCircle2 size={38} className="text-emerald-400" />
          <p className="mt-5 text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">Request received</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-.04em]">We&apos;ve got it.</h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-neutral-300">
            Someone from our team will confirm your viewing within 24 hours.
          </p>
        </div>
        <div className="grid gap-px bg-white/10 sm:grid-cols-3">
          <ConfirmationItem label="Vehicle" value={confirmation.car.name} />
          <ConfirmationItem
            label="Requested time"
            value={new Date(confirmation.lead.appointmentTime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
          />
          <ConfirmationItem label="Approximate area" value={confirmation.car.locationLabel} />
        </div>
      </section>
    );
  }

  const fieldClass = "mobile-form-control mt-2 h-12 min-w-0 w-full max-w-full border border-white/15 bg-[#0a0c0f] px-3 text-base font-normal normal-case text-white outline-none transition placeholder:text-neutral-600 focus:border-[#ef4538] focus:ring-2 focus:ring-[#ef4538]/15";
  const sectionTitle = "text-[10px] font-black uppercase tracking-[.17em] text-[#ff655a]";

  return (
    <form onSubmit={submit} className={`w-full min-w-0 max-w-full overflow-hidden border border-white/10 bg-[#111418] text-white shadow-[0_28px_90px_rgba(0,0,0,.42)] ${compact ? "p-4 sm:p-7" : "p-4 sm:p-8"}`}>
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <p className={sectionTitle}>Reserve your viewing</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-.04em] sm:text-3xl">Tell us what works for you.</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-400">Our team confirms the vehicle before you make the drive.</p>
        </div>
        <span className="hidden h-11 w-11 shrink-0 place-items-center border border-white/10 bg-[#090b0e] text-[#ff655a] sm:grid"><CalendarDays size={20} /></span>
      </div>

      <section className="pt-6">
        <p className={sectionTitle}>Contact</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Full name" name="name" autoComplete="name" placeholder="Your full name" className={fieldClass} />
          <Field label="Phone" name="phone" type="tel" autoComplete="tel" placeholder="(604) 555-0123" className={fieldClass} />
          <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" className={`${fieldClass} sm:col-span-2`} optional />
        </div>
      </section>

      <section className="mt-7 border-t border-white/10 pt-6">
        <p className={sectionTitle}>Vehicle</p>
        <label className="relative mt-3 block min-w-0 max-w-full text-[10px] font-black uppercase tracking-[.12em] text-neutral-400">
          Live inventory
          <div className="relative">
            <Search size={17} className="absolute left-3 top-1/2 mt-1 -translate-y-1/2 text-neutral-500" />
            <input
              className={`${fieldClass} pl-10`}
              value={search}
              onChange={(event) => { setSearch(event.target.value); setSelected(null); }}
              placeholder="Search year, make, model, or stock"
              autoComplete="off"
            />
          </div>
          {!selected && search && (
            <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto overscroll-contain border border-white/15 bg-[#111418] p-1 shadow-2xl">
              {cars.length ? cars.map((car) => (
                <button
                  type="button"
                  key={car.id}
                  onClick={() => chooseCar(car)}
                  className="flex w-full min-w-0 items-center justify-between gap-3 border-b border-white/10 p-3 text-left normal-case transition last:border-0 hover:bg-white/5"
                >
                  <span className="min-w-0">
                    <strong className="block break-words text-sm leading-5 text-white">{carName(car)}</strong>
                    <span className="mt-1 block truncate text-xs text-neutral-500">{priceLabel(car)} · {car.location_label}</span>
                  </span>
                  <ChevronRight size={17} className="shrink-0 text-neutral-500" />
                </button>
              )) : <p className="p-4 text-center text-sm font-normal normal-case text-neutral-500">No matching vehicles found.</p>}
            </div>
          )}
        </label>
        {selected && (
          <div className="mt-3 grid gap-3 border border-white/10 bg-[#090b0e] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <small className="font-bold uppercase tracking-[.12em] text-neutral-500">Selected vehicle</small>
              <strong className="mt-1 block break-words text-base">{carName(selected)}</strong>
              {selected.stock && <span className="mt-1 block text-xs text-neutral-500">Stock #{selected.stock}</span>}
            </div>
            <span className="flex items-center gap-2 text-sm font-bold text-[#ff655a]"><MapPin size={16} />{selected.location_label}</span>
          </div>
        )}
      </section>

      <section className="mt-7 border-t border-white/10 pt-6">
        <p className={sectionTitle}>Payment</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="border border-white/15 bg-[#0a0c0f] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="budget-range" className="text-[10px] font-black uppercase tracking-[.12em] text-neutral-400">Approximate budget</label>
              <output htmlFor="budget-range" className="text-lg font-black tabular-nums">${budget.toLocaleString()}</output>
            </div>
            <input
              id="budget-range"
              className="budget-range mt-3 w-full"
              type="range"
              min="5000"
              max="250000"
              step="1000"
              value={budget}
              style={{ "--budget-progress": `${((budget - 5000) / 245000) * 100}%` }}
              onChange={(event) => setBudget(Number(event.target.value))}
            />
            <div className="mt-1 flex justify-between text-[10px] font-semibold text-neutral-600"><span>$5k</span><span>$250k+</span></div>
          </div>
          <label className="text-[10px] font-black uppercase tracking-[.12em] text-neutral-400">
            How do you plan to pay?
            <select name="paymentMethod" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} required className={fieldClass}>
              <option value="">Choose one</option>
              <option>Cash</option>
              <option>Finance</option>
              <option>Lease</option>
            </select>
          </label>
          {["Finance", "Lease"].includes(paymentMethod) && (
            <>
              <Field label="Down payment available" name="downPayment" type="number" min="0" step="500" placeholder="$0" className={fieldClass} />
              <label className="text-[10px] font-black uppercase tracking-[.12em] text-neutral-400">
                Credit range <span className="font-medium normal-case tracking-normal text-neutral-600">(optional)</span>
                <select name="creditRange" className={fieldClass}>
                  <option value="">Prefer not to say</option>
                  {CREDIT_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
            </>
          )}
        </div>
      </section>

      <fieldset className="mt-7 min-w-0 border-t border-white/10 pt-6" disabled={!selected}>
        <legend className={`${sectionTitle} flex items-center gap-2`}><Clock3 size={14} />Preferred viewing date + time</legend>
        <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-neutral-400">
          <ShieldCheck size={16} className="mt-1 shrink-0 text-[#ff655a]" />
          We need 24 hours to confirm the vehicle and arrange your viewing.
        </p>
        <div className="mobile-slot-scroll mt-4 flex w-full min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-2">
          {[...groups.keys()].map((label) => (
            <button
              type="button"
              key={label}
              onClick={() => setDate(label)}
              className={`shrink-0 border px-3 py-2.5 text-sm font-bold transition ${date === label ? "border-white bg-white text-black" : "border-white/15 bg-[#0a0c0f] text-neutral-300 hover:border-white/40"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {(groups.get(date) || []).map((slot) => (
            <button
              type="button"
              key={slot.iso}
              onClick={() => setAppointmentTime(slot.iso)}
              className={`border p-2.5 text-sm font-bold transition ${appointmentTime === slot.iso ? "border-[#ef4538] bg-[#ef4538] text-white" : "border-white/15 bg-[#0a0c0f] text-neutral-200 hover:border-[#ef4538]"}`}
            >
              {slot.timeLabel}
            </button>
          ))}
        </div>
        {!selected && <p className="mt-3 border border-white/10 bg-[#0a0c0f] p-3 text-sm font-normal normal-case text-neutral-500">Choose a vehicle to see available times.</p>}
        {selected && !slots.length && <p className="mt-3 border border-white/10 bg-[#0a0c0f] p-3 text-sm text-neutral-500">No times are currently available for this vehicle.</p>}
      </fieldset>

      <section className="mt-7 border-t border-white/10 pt-6">
        <p className={sectionTitle}>A little more</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-[10px] font-black uppercase tracking-[.12em] text-neutral-400">
            How did you hear about us?
            <select name="heardFrom" required className={fieldClass}>
              <option value="">Choose one</option>
              {["Instagram", "Facebook", "Google", "Referral", "Other"].map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-black uppercase tracking-[.12em] text-neutral-400">
            Source
            <input value="604SELLSCARS" readOnly aria-readonly="true" className={`${fieldClass} cursor-not-allowed text-neutral-500`} />
          </label>
          <label className="text-[10px] font-black uppercase tracking-[.12em] text-neutral-400 sm:col-span-2">
            Notes / anything else you&apos;re looking for
            <textarea name="notes" rows="3" placeholder="Optional" className={`${fieldClass} h-auto min-h-[92px] py-3`} />
          </label>
        </div>
      </section>

      {error && <p role="alert" className="mt-5 border border-red-400/30 bg-red-500/10 p-3 text-sm font-semibold text-red-200">{error}</p>}
      <button disabled={submitting} className="mt-6 flex min-h-14 w-full items-center justify-center gap-3 bg-[#ef4538] px-5 py-4 font-black text-white transition hover:bg-[#d9362b] disabled:opacity-60">
        <span>{submitting ? "Sending request…" : "Request my viewing"}</span><ChevronRight size={18} />
      </button>
      <p className="mt-4 flex items-start justify-center gap-2 text-center text-xs font-medium leading-5 text-neutral-500">
        <LockKeyhole size={13} className="mt-0.5 shrink-0" /> No credit application, SIN, date of birth, or document upload.
      </p>
    </form>
  );
}

function Field({ label, className, optional = false, ...props }) {
  return (
    <label className={`text-[10px] font-black uppercase tracking-[.12em] text-neutral-400 ${props.name === "email" ? "sm:col-span-2" : ""}`}>
      {label}{optional && <span className="ml-1 font-medium normal-case tracking-normal text-neutral-600">(optional)</span>}
      <input className={className} required={!optional} {...props} />
    </label>
  );
}

function ConfirmationItem({ label, value }) {
  return <div className="bg-[#111418] p-5"><small className="font-bold uppercase tracking-[.12em] text-neutral-500">{label}</small><strong className="mt-2 block leading-snug">{value}</strong></div>;
}
