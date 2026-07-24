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
    <div className="min-h-screen bg-neutral-100 text-neutral-950">
      <SiteHeader admin />
      <main className="mx-auto w-[min(1400px,94vw)] py-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-red-600">604 Sell Cars operations</p><h1 className="mt-2 text-5xl font-black tracking-tight">{tab === "leads" ? "Lead desk" : "Inventory"}</h1></div>
          <a href="https://dealership-inventory-board.netlify.app" className="rounded-md bg-neutral-900 px-4 py-3 font-bold text-white">Open inventory board ↗</a>
        </div>
        {notice && <button onClick={() => setNotice("")} className="mt-5 w-full bg-neutral-900 p-3 text-left text-sm text-white">{notice} ×</button>}
        {tab === "leads" ? (
          <>
            <div className="mt-8 flex flex-wrap gap-3 bg-white p-4">
              <label className="text-xs font-bold uppercase">Lot<select value={lot} onChange={(event) => setLot(event.target.value)} className="ml-2 border p-2"><option value="">All lots</option>{lots.map((item) => <option key={item.lot} value={item.lot}>{item.lot_name}</option>)}</select></label>
              <label className="text-xs font-bold uppercase">Appointment date<input value={date} onChange={(event) => setDate(event.target.value)} type="date" className="ml-2 border p-2" /></label>
            </div>
            <p className="mt-4 text-sm text-neutral-500">{leads.length} leads, newest first</p>
            <div className="mt-3 grid gap-4">
              {leads.map((lead, index) => (
                <article key={lead.id} className="border border-neutral-200 bg-white p-5">
                  <div className="flex flex-wrap justify-between gap-4 border-b pb-4">
                    <div><span className={`px-2 py-1 text-xs font-black uppercase ${lead.appointment_status === "cancelled" ? "bg-neutral-200" : "bg-green-100 text-green-800"}`}>{lead.appointment_status}</span><h2 className="mt-2 text-2xl font-black">{lead.name}</h2><a className="text-red-600" href={`tel:${lead.phone}`}>{lead.phone}</a></div>
                    <div className="sm:text-right"><small className="uppercase text-neutral-500">Appointment</small><strong className="block">{new Date(lead.appointment_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</strong></div>
                  </div>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                    <Data term="Lead / car ID" value={`#${lead.id} / ${lead.car_id}`} />
                    <Data term="Vehicle" value={carName(lead)} />
                    <Data term="Budget" value={`$${Number(lead.budget).toLocaleString()}`} />
                    <Data term="Email" value={lead.email || "—"} />
                    <Data term="Lot" value={`${lead.lot_name} — ${lead.lot_address}`} />
                    <Data term="Created / updated" value={`${new Date(lead.created_at).toLocaleDateString()} / ${new Date(lead.updated_at).toLocaleDateString()}`} />
                  </dl>
                  <div className="mt-5 grid gap-3 border-t pt-4 lg:grid-cols-[1fr_180px_2fr_auto]">
                    <label className="text-xs font-bold uppercase">Assigned to<input value={lead.assigned_to || ""} onChange={(event) => setLeads((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, assigned_to: event.target.value } : item))} className="mt-1 w-full border p-2 normal-case" /></label>
                    <label className="text-xs font-bold uppercase">Status<select value={lead.appointment_status} onChange={(event) => setLeads((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, appointment_status: event.target.value } : item))} className="mt-1 w-full border p-2 normal-case"><option value="booked">Booked</option><option value="cancelled">Cancelled</option></select></label>
                    <label className="text-xs font-bold uppercase">Notes<textarea value={lead.notes || ""} onChange={(event) => setLeads((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, notes: event.target.value } : item))} className="mt-1 w-full border p-2 normal-case" rows="2" /></label>
                    <button onClick={() => saveLead(lead)} className="self-end bg-neutral-950 px-5 py-3 font-bold text-white">Save</button>
                  </div>
                </article>
              ))}
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
  return <div><dt className="text-[10px] font-black uppercase tracking-wide text-neutral-500">{term}</dt><dd className="mt-1 text-sm">{value}</dd></div>;
}
