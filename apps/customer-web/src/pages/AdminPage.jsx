import React, { useEffect, useState } from "react";
import AuthScreen from "../AuthScreen";
import SiteHeader from "../components/SiteHeader";
import { api, carName, mileageLabel, priceLabel } from "../lib/api";
import { supabase } from "../lib/supabase";

const blankCar = {
  id: "", year: "", make: "", model: "", trim: "", stock: "", price: "", mileage: "",
  bodyType: "", fuelType: "", fuelTags: [], lot: "", lotName: "", lotAddress: "",
  status: "available", description: "", carfaxUrl: "", featured: false, labels: [],
};
const LABELS = ["HOT SELL", "NEW ARRIVAL", "HAS CARFAX"];

export default function AdminPage() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  if (session === undefined) {
    return <div className="grid min-h-screen place-items-center bg-neutral-950 text-neutral-400">Connecting securely…</div>;
  }
  if (!session) return <AuthScreen />;
  return <AdminDashboard />;
}

function AdminDashboard() {
  const tab = "leads";
  const [leads, setLeads] = useState([]);
  const [cars, setCars] = useState([]);
  const [lots, setLots] = useState([]);
  const [lot, setLot] = useState("");
  const [date, setDate] = useState("");
  const [form, setForm] = useState(blankCar);
  const [formOpen, setFormOpen] = useState(false);
  const [media, setMedia] = useState([]);
  const [notice, setNotice] = useState("");
  const routingBlocked = cars.filter((car) =>
    car.lot === "LOCATION_REQUIRED" || car.lot_address === "ADDRESS REQUIRED",
  );

  const loadLeads = () => api(`/api/admin/leads?lot=${encodeURIComponent(lot)}&date=${encodeURIComponent(date)}`).then(setLeads);
  const loadCars = () => api("/api/admin/cars").then(setCars);
  useEffect(() => {
    loadLeads().catch((error) => setNotice(error.message));
    loadCars().catch((error) => setNotice(error.message));
    api("/api/admin/lots").then(setLots).catch(() => {});
  }, []);
  useEffect(() => { loadLeads().catch((error) => setNotice(error.message)); }, [lot, date]);

  async function saveLead(lead) {
    try {
      await api(`/api/admin/leads/${lead.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedTo: lead.assigned_to,
          notes: lead.notes,
          appointmentStatus: lead.appointment_status,
        }),
      });
      setNotice("Lead saved.");
      loadLeads();
    } catch (error) { setNotice(error.message); }
  }

  function editCar(car = blankCar) {
    setForm({
      id: car.id || "", year: car.year || "", make: car.make || "", model: car.model || "",
      trim: car.trim || "", stock: car.stock || "", price: car.price_amount ?? car.price ?? "",
      mileage: car.mileage ?? car.kms ?? "", bodyType: car.body_type || "",
      fuelType: car.fuel_type || "", fuelTags: car.fuel_tags || [], lot: car.lot === "LOCATION_REQUIRED" ? "" : (car.lot || ""),
      lotName: car.lot_name === "LOCATION REQUIRED" ? "" : (car.lot_name || ""),
      lotAddress: car.lot_address === "ADDRESS REQUIRED" ? "" : (car.lot_address || ""),
      status: car.status || "available", description: car.description || "",
      carfaxUrl: car.carfax_url || "", featured: Boolean(car.featured), labels: car.labels || [],
    });
    setMedia([]);
    setFormOpen(true);
  }

  async function saveCar(event) {
    event.preventDefault();
    try {
      const saved = await api(form.id ? `/api/admin/cars/${form.id}` : "/api/admin/cars", {
        method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (media.length) {
        const body = new FormData();
        [...media].forEach((file) => body.append("media", file));
        await api(`/api/admin/cars/${saved.id}/media`, { method: "POST", body });
      }
      setNotice("Vehicle saved.");
      setFormOpen(false);
      await loadCars();
    } catch (error) { setNotice(error.message); }
  }

  return (
    <div className="min-h-screen bg-[#090a0c] text-white">
      <SiteHeader admin />
      <main className="mx-auto w-[min(1400px,94vw)] py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#ff5a50]">604 Sell Cars operations</p>
            <h1 className="mt-3 text-[clamp(2.6rem,5vw,4.5rem)] font-black leading-none tracking-[-.055em]">{tab === "leads" ? "Lead desk" : "Inventory"}</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-400">Appointments, assignments, and customer follow-up in one operating view.</p>
          </div>
          <a href="https://dealership-inventory-board.netlify.app" className="border border-white/15 bg-[#121417] px-4 py-3 text-sm font-bold text-white transition hover:border-white/30 hover:bg-[#181b20]">Open inventory board ↗</a>
        </div>
        {notice && <button onClick={() => setNotice("")} className="mt-5 w-full border border-[#ef3f32]/30 bg-[#ef3f32]/10 p-3 text-left text-sm text-red-100">{notice} ×</button>}
        {tab === "leads" ? (
          <>
            <div className="mt-8 grid gap-4 border border-white/10 bg-[#121417] p-4 sm:grid-cols-2 sm:p-5">
              <label className="text-[10px] font-black uppercase tracking-[.14em] text-neutral-500">Dealership lot<select value={lot} onChange={(event) => setLot(event.target.value)} className="mt-2 h-11 w-full border border-white/10 bg-[#0d0f12] px-3 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-neutral-500"><option value="">All lots</option>{lots.map((item) => <option key={item.lot} value={item.lot}>{item.lot_name}</option>)}</select></label>
              <label className="text-[10px] font-black uppercase tracking-[.14em] text-neutral-500">Appointment date<input value={date} onChange={(event) => setDate(event.target.value)} type="date" className="mt-2 h-11 w-full border border-white/10 bg-[#0d0f12] px-3 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-neutral-500" /></label>
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[.14em] text-neutral-500">{leads.length} leads · newest first</p>
            <div className="mt-3 grid gap-4">
              {leads.map((lead, index) => (
                <article key={lead.id} className="border border-white/10 bg-[#121417] p-4 transition hover:border-white/20 sm:p-5">
                  <div className="flex flex-wrap justify-between gap-4 border-b border-white/10 pb-4">
                    <div><span className={`inline-flex border px-2.5 py-1 text-[9px] font-black uppercase tracking-[.13em] ${lead.appointment_status === "cancelled" ? "border-white/10 bg-white/5 text-neutral-400" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"}`}>{lead.appointment_status}</span><h2 className="mt-3 text-2xl font-black tracking-[-.035em]">{lead.name}</h2><a className="mt-1 block text-sm font-bold text-[#ff5a50]" href={`tel:${lead.phone}`}>{lead.phone}</a></div>
                    <div className="sm:text-right"><small className="text-[9px] font-black uppercase tracking-[.14em] text-neutral-500">Appointment</small><strong className="mt-1 block text-sm">{new Date(lead.appointment_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</strong></div>
                  </div>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                    <Data term="Lead / car ID" value={`#${lead.id} / ${lead.car_id}`} />
                    <Data term="Vehicle" value={carName(lead)} />
                    <Data term="Budget" value={`$${Number(lead.budget).toLocaleString()}`} />
                    <Data term="Email" value={lead.email || "—"} />
                    <Data term="Lot" value={`${lead.lot_name} — ${lead.lot_address}`} />
                    <Data term="Created / updated" value={`${new Date(lead.created_at).toLocaleDateString()} / ${new Date(lead.updated_at).toLocaleDateString()}`} />
                  </dl>
                  <div className="mt-5 grid gap-3 border-t border-white/10 pt-4 lg:grid-cols-[1fr_180px_2fr_auto]">
                    <label className="text-[10px] font-black uppercase tracking-[.12em] text-neutral-500">Assigned to<input value={lead.assigned_to || ""} onChange={(event) => setLeads((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, assigned_to: event.target.value } : item))} className="mt-2 h-11 w-full border border-white/10 bg-[#0d0f12] px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-neutral-500" /></label>
                    <label className="text-[10px] font-black uppercase tracking-[.12em] text-neutral-500">Status<select value={lead.appointment_status} onChange={(event) => setLeads((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, appointment_status: event.target.value } : item))} className="mt-2 h-11 w-full border border-white/10 bg-[#0d0f12] px-3 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-neutral-500"><option value="booked">Booked</option><option value="cancelled">Cancelled</option></select></label>
                    <label className="text-[10px] font-black uppercase tracking-[.12em] text-neutral-500">Notes<textarea value={lead.notes || ""} onChange={(event) => setLeads((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, notes: event.target.value } : item))} className="mt-2 w-full border border-white/10 bg-[#0d0f12] p-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-neutral-500" rows="2" /></label>
                    <button onClick={() => saveLead(lead)} className="self-end bg-[#ef3f32] px-5 py-3 text-sm font-black text-white transition hover:bg-[#d92d22]">Save lead</button>
                  </div>
                </article>
              ))}
              {!leads.length && (
                <div className="border border-white/10 bg-[#121417] px-6 py-16 text-center">
                  <h2 className="text-xl font-black">No leads match these filters</h2>
                  <p className="mt-2 text-sm text-neutral-500">Try another dealership or appointment date.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-neutral-200 bg-white p-4"><small className="font-bold uppercase tracking-wide text-neutral-500">Total inventory</small><strong className="mt-2 block text-3xl">{cars.length}</strong></div>
              <div className="rounded-lg border border-neutral-200 bg-white p-4"><small className="font-bold uppercase tracking-wide text-neutral-500">Publicly available</small><strong className="mt-2 block text-3xl">{cars.filter((car) => car.status === "available" && car.lot !== "LOCATION_REQUIRED" && car.lot_address !== "ADDRESS REQUIRED").length}</strong></div>
              <div className={`rounded-lg border p-4 ${routingBlocked.length ? "border-amber-300 bg-amber-50" : "border-neutral-200 bg-white"}`}><small className="font-bold uppercase tracking-wide text-neutral-500">Needs exact location</small><strong className="mt-2 block text-3xl">{routingBlocked.length}</strong></div>
            </div>
            {routingBlocked.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <strong>{routingBlocked.length} vehicles are hidden from the public website.</strong>
                <p className="mt-1">Open each vehicle and add the exact physical lot plus full street address. This prevents customers from being routed to the wrong branch.</p>
              </div>
            )}
            <div className="mt-5 flex justify-end"><button onClick={() => editCar()} className="rounded-md bg-red-600 px-5 py-3 font-black text-white">+ Add vehicle</button></div>
            {formOpen && (
              <form onSubmit={saveCar} className="mt-4 border border-neutral-200 bg-white p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["year", "Year", "number"], ["make", "Make"], ["model", "Model"], ["trim", "Trim"],
                    ["stock", "Stock"], ["price", "Price", "number"], ["mileage", "Mileage", "number"],
                    ["bodyType", "Body type"], ["fuelType", "Fuel type"], ["lot", "Lot code"],
                    ["lotName", "Lot name"], ["lotAddress", "Full street address"], ["carfaxUrl", "CARFAX URL"],
                  ].map(([name, label, type = "text"]) => (
                    <label key={name} className="text-xs font-bold uppercase">{label}{["make", "model", "lot", "lotName", "lotAddress"].includes(name) ? " *" : ""}
                      <input type={type} required={["year", "make", "model", "price", "mileage", "lot", "lotName", "lotAddress"].includes(name)}
                        value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} className="mt-1 w-full border p-2 normal-case" />
                    </label>
                  ))}
                  <label className="text-xs font-bold uppercase">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-1 w-full border p-2"><option value="available">Available</option><option value="sold">Sold</option></select></label>
                  <label className="flex items-center gap-2 text-xs font-bold uppercase"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Featured</label>
                  <label className="sm:col-span-2 lg:col-span-4 text-xs font-bold uppercase">Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows="6" className="mt-1 w-full border p-2 normal-case" /></label>
                  <div className="sm:col-span-2 lg:col-span-4"><span className="text-xs font-bold uppercase">Labels</span><div className="mt-2 flex flex-wrap gap-3">{LABELS.map((label) => <label key={label} className="flex gap-2 text-sm"><input type="checkbox" checked={form.labels.includes(label)} onChange={(event) => setForm({ ...form, labels: event.target.checked ? [...form.labels, label] : form.labels.filter((item) => item !== label) })} />{label}</label>)}</div></div>
                  <label className="sm:col-span-2 lg:col-span-4 text-xs font-bold uppercase">Images and videos<input type="file" accept="image/*,video/*" multiple onChange={(event) => setMedia(event.target.files)} className="mt-1 block w-full border p-3 normal-case" /><span className="mt-1 block normal-case text-red-600">Choose the front exterior photo first. The first selected image becomes the website cover.</span><span className="mt-1 block normal-case text-neutral-500">Images are compressed and receive thumbnails on upload. Upload additional batches for galleries over 20 files.</span></label>
                </div>
                <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setFormOpen(false)} className="border px-5 py-3">Cancel</button><button className="bg-neutral-950 px-5 py-3 font-black text-white">Save vehicle</button></div>
              </form>
            )}
            <div className="mt-5 overflow-auto border border-neutral-200 bg-white">
              <table className="w-full min-w-[800px] border-collapse text-left"><thead><tr className="border-b bg-neutral-50 text-xs uppercase text-neutral-500"><th className="p-3">Vehicle</th><th>Price</th><th>Mileage</th><th>Lot</th><th>Status</th><th>Media</th><th /></tr></thead>
                <tbody>{cars.map((car) => <tr key={car.id} className="border-b"><td className="p-3"><strong>{carName(car)}</strong><small className="block text-neutral-500">{car.stock}</small></td><td>{priceLabel(car)}</td><td>{mileageLabel(car)}</td><td className={car.lot === "LOCATION_REQUIRED" || car.lot_address === "ADDRESS REQUIRED" ? "font-bold text-amber-700" : ""}>{car.lot_name}<small className="block">{car.lot_address}</small></td><td>{car.status}</td><td>{(car.images || []).length} photos · {(car.videos || []).length} videos</td><td><button onClick={() => editCar(car)} className="p-3 font-bold text-red-600">Edit</button></td></tr>)}</tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Data({ term, value }) {
  return <div><dt className="text-[9px] font-black uppercase tracking-[.13em] text-neutral-500">{term}</dt><dd className="mt-1.5 break-words text-sm leading-5 text-neutral-300">{value}</dd></div>;
}
