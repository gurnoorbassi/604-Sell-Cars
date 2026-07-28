import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, CalendarDays, Phone, RefreshCw, UserRound } from "lucide-react";
import AuthScreen from "../AuthScreen";
import SiteHeader from "../components/SiteHeader";
import { api, carName } from "../lib/api";
import { setPageMeta } from "../lib/pageMeta";
import { supabase } from "../lib/supabase";

const HANDOFFS = [
  ["pending_confirmation", "Pending confirmation"],
  ["verified", "Vehicle verified"],
  ["handed_off", "Handed to rep"],
  ["source_alternative", "Source alternative"],
  ["closed", "Closed"],
];

const APPOINTMENT_STATUSES = [
  ["new", "New"],
  ["assigned", "Assigned"],
  ["booked", "Booked"],
  ["cancelled", "Cancelled"],
  ["completed", "Completed"],
  ["no_show", "No-show"],
];

export default function AdminPage() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    setPageMeta({
      title: "Lead Desk | 604 Sell Cars",
      description: "Protected 604 Sell Cars lead operations.",
      robots: "noindex,nofollow",
    });
  }, []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession || null));
    return () => listener.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <div className="grid min-h-screen place-items-center bg-[#08090b] text-neutral-500">Connecting securely…</div>;
  if (!session) return <AuthScreen />;
  return <LeadDesk />;
}

function LeadDesk() {
  const [leads, setLeads] = useState([]);
  const [sellerLeads, setSellerLeads] = useState([]);
  const [lots, setLots] = useState([]);
  const [lot, setLot] = useState("");
  const [date, setDate] = useState("");
  const [view, setView] = useState("buyers");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [buyerRows, sellerRows] = await Promise.all([
        api(`/api/admin/leads?lot=${encodeURIComponent(lot)}&date=${encodeURIComponent(date)}`),
        api("/api/admin/seller-leads"),
      ]);
      setLeads(buyerRows);
      setSellerLeads(sellerRows);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api("/api/admin/lots").then(setLots).catch(() => {});
  }, [lot, date]);

  const today = new Date().toDateString();
  const stats = useMemo(() => ({
    total: leads.length,
    today: leads.filter((lead) => new Date(lead.appointment_time).toDateString() === today).length,
    pending: leads.filter((lead) => lead.handoff_status === "pending_confirmation").length,
    alternatives: leads.filter((lead) => lead.routing_flag === "SOURCE ALTERNATIVE").length,
  }), [leads]);

  async function saveLead(lead) {
    try {
      await api(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedTo: lead.assigned_to,
          notes: lead.notes,
          appointmentStatus: lead.appointment_status,
          handoffStatus: lead.handoff_status,
        }),
      });
      setNotice(`Saved ${lead.name}.`);
      await load();
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function saveSeller(lead) {
    try {
      await api(`/api/admin/seller-leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: lead.assigned_to, notes: lead.notes, status: lead.status }),
      });
      setNotice(`Saved ${lead.name}.`);
      await load();
    } catch (error) {
      setNotice(error.message);
    }
  }

  const updateBuyer = (id, patch) => setLeads((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  const updateSeller = (id, patch) => setSellerLeads((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));

  return (
    <div className="min-h-screen bg-[#08090b] text-white">
      <SiteHeader admin />
      <main className="mx-auto w-[min(1440px,94vw)] py-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#ff655a]">604SELLSCARS operations</p>
            <h1 className="mt-3 text-[clamp(2.6rem,5vw,4.6rem)] font-black leading-none tracking-[-.06em]">Lead desk</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-400">Verify the vehicle first, then hand a confirmed appointment to the rep who can access that lot.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="grid h-11 w-11 place-items-center border border-white/15 bg-[#111418] hover:border-white/30" aria-label="Refresh leads"><RefreshCw size={16} /></button>
            <a href="https://dealership-inventory-board.netlify.app" className="flex h-11 items-center gap-2 border border-white/15 bg-[#111418] px-4 text-sm font-bold transition hover:border-white/30">Inventory board <ArrowUpRight size={14} /></a>
          </div>
        </div>

        {notice && <button onClick={() => setNotice("")} className="mt-5 w-full border border-[#ef4538]/30 bg-[#ef4538]/10 p-3 text-left text-sm text-red-100">{notice} ×</button>}

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Buyer leads" value={stats.total} />
          <Stat label="Viewings today" value={stats.today} />
          <Stat label="Needs verification" value={stats.pending} />
          <Stat label="Source alternative" value={stats.alternatives} alert={stats.alternatives > 0} />
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-b border-white/10">
          <div className="flex gap-1">
            <Tab active={view === "buyers"} onClick={() => setView("buyers")}>Buyer leads ({leads.length})</Tab>
            <Tab active={view === "sellers"} onClick={() => setView("sellers")}>Seller leads ({sellerLeads.length})</Tab>
          </div>
          {view === "buyers" && (
            <div className="mb-3 grid w-full gap-3 sm:w-auto sm:grid-cols-2">
              <select value={lot} onChange={(event) => setLot(event.target.value)} className="h-10 border border-white/10 bg-[#111418] px-3 text-base text-white outline-none">
                <option value="">All permitted lots</option>
                {lots.map((item) => <option key={item.lot} value={item.lot}>{item.lot_name}</option>)}
              </select>
              <input value={date} onChange={(event) => setDate(event.target.value)} type="date" className="h-10 border border-white/10 bg-[#111418] px-3 text-base text-white outline-none" />
            </div>
          )}
        </div>

        {loading ? <p className="py-16 text-center text-sm text-neutral-500">Loading current leads…</p> : view === "buyers" ? (
          <div className="mt-5 grid gap-4">
            {leads.map((lead) => (
              <BuyerLead key={lead.id} lead={lead} update={(patch) => updateBuyer(lead.id, patch)} save={() => saveLead(lead)} />
            ))}
            {!leads.length && <Empty text="No buyer leads match the current filters." />}
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {sellerLeads.map((lead) => (
              <SellerLead key={lead.id} lead={lead} update={(patch) => updateSeller(lead.id, patch)} save={() => saveSeller(lead)} />
            ))}
            {!sellerLeads.length && <Empty text="No seller leads yet." />}
          </div>
        )}
      </main>
    </div>
  );
}

function BuyerLead({ lead, update, save }) {
  const unavailable = lead.routing_flag === "SOURCE ALTERNATIVE";
  return (
    <article className={`border bg-[#111418] p-4 sm:p-6 ${unavailable ? "border-amber-400/40" : "border-white/10"}`}>
      <div className="flex flex-wrap justify-between gap-5 border-b border-white/10 pb-5">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge>{lead.source || "604SELLSCARS"}</Badge>
            <Badge tone={lead.appointment_status === "cancelled" ? "muted" : "green"}>{lead.appointment_status}</Badge>
            {unavailable && <Badge tone="amber">SOURCE ALTERNATIVE</Badge>}
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-[-.04em]">{lead.name}</h2>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <a className="flex items-center gap-2 font-bold text-[#ff655a]" href={`tel:${lead.phone}`}><Phone size={14} />{lead.phone}</a>
            <a className="text-neutral-400 hover:text-white" href={`mailto:${lead.email}`}>{lead.email}</a>
          </div>
        </div>
        <div className="sm:text-right">
          <small className="text-[9px] font-black uppercase tracking-[.14em] text-neutral-500">Requested viewing</small>
          <strong className="mt-2 flex items-center gap-2 text-sm sm:justify-end"><CalendarDays size={15} className="text-[#ff655a]" />{new Date(lead.appointment_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</strong>
        </div>
      </div>

      {unavailable && (
        <div className="mt-4 flex items-start gap-3 border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />The selected vehicle is unavailable. Source a matching alternative before contacting this lead.
        </div>
      )}

      <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Data term="Vehicle" value={`${carName(lead)}${lead.stock ? ` · #${lead.stock}` : ""}`} />
        <Data term="True source lot" value={`${lead.lot_name || lead.appointment_lot}${lead.lot_address ? ` · ${lead.lot_address}` : ""}`} />
        <Data term="Budget" value={`$${Number(lead.budget || 0).toLocaleString()}`} />
        <Data term="Payment" value={`${lead.payment_method || "—"}${lead.down_payment != null ? ` · $${Number(lead.down_payment).toLocaleString()} down` : ""}`} />
        <Data term="Credit range" value={lead.credit_range || "Not provided"} />
        <Data term="Heard from" value={lead.heard_from || "—"} />
        <Data term="Customer notes" value={lead.customer_notes || "—"} />
        <Data term="SMS consent" value={lead.consent_sms ? "Granted" : "Not granted"} />
        <Data
          term="SMS reminders"
          value={[
            `24h ${lead.reminder_24h_sent_at ? "sent" : "pending"}`,
            `3h ${lead.reminder_3h_sent_at ? "sent" : "pending"}`,
            `1h ${lead.reminder_1h_sent_at ? "sent" : "pending"}`,
          ].join(" · ")}
        />
        <Data term="Lead ID / created" value={`#${lead.id} · ${new Date(lead.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`} />
      </dl>

      <div className="mt-5 grid gap-3 border-t border-white/10 pt-5 lg:grid-cols-[1fr_190px_220px_2fr_auto]">
        <DeskField label="Assigned rep" value={lead.assigned_to || ""} onChange={(value) => update({ assigned_to: value })} />
        <DeskSelect label="Appointment" value={lead.appointment_status} onChange={(value) => update({ appointment_status: value })} options={APPOINTMENT_STATUSES} />
        <DeskSelect label="Handoff" value={lead.handoff_status || "pending_confirmation"} onChange={(value) => update({ handoff_status: value })} options={HANDOFFS} />
        <label className="text-[9px] font-black uppercase tracking-[.12em] text-neutral-500">Internal notes<textarea value={lead.notes || ""} onChange={(event) => update({ notes: event.target.value })} className="mt-2 min-h-11 w-full border border-white/10 bg-[#090b0e] p-3 text-base font-normal normal-case tracking-normal text-white outline-none focus:border-white/30" rows="2" /></label>
        <button onClick={save} className="self-end bg-[#ef4538] px-5 py-3 text-sm font-black text-white transition hover:bg-[#d9362b]">Save</button>
      </div>
    </article>
  );
}

function SellerLead({ lead, update, save }) {
  return (
    <article className="border border-white/10 bg-[#111418] p-4 sm:p-6">
      <div className="flex flex-wrap justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <Badge>{lead.source}</Badge>
          <h2 className="mt-3 text-2xl font-black">{lead.name}</h2>
          <a className="mt-2 flex items-center gap-2 text-sm font-bold text-[#ff655a]" href={`tel:${lead.phone}`}><Phone size={14} />{lead.phone}</a>
        </div>
        <Data term="Submitted" value={new Date(lead.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} />
      </div>
      <h3 className="mt-5 text-lg font-black">{lead.vehicle}</h3>
      {lead.media_urls?.length > 0 && <div className="mt-4 flex gap-2 overflow-x-auto">{lead.media_urls.map((url) => <img key={url} src={url} alt="" className="h-28 w-36 shrink-0 object-cover" />)}</div>}
      <div className="mt-5 grid gap-3 border-t border-white/10 pt-5 lg:grid-cols-[1fr_180px_2fr_auto]">
        <DeskField label="Assigned rep" value={lead.assigned_to || ""} onChange={(value) => update({ assigned_to: value })} />
        <DeskSelect label="Status" value={lead.status} onChange={(value) => update({ status: value })} options={[["new", "New"], ["contacted", "Contacted"], ["closed", "Closed"]]} />
        <label className="text-[9px] font-black uppercase tracking-[.12em] text-neutral-500">Internal notes<textarea value={lead.notes || ""} onChange={(event) => update({ notes: event.target.value })} className="mt-2 min-h-11 w-full border border-white/10 bg-[#090b0e] p-3 text-base font-normal normal-case tracking-normal text-white outline-none" rows="2" /></label>
        <button onClick={save} className="self-end bg-[#ef4538] px-5 py-3 text-sm font-black">Save</button>
      </div>
    </article>
  );
}

function Stat({ label, value, alert = false }) {
  return <div className={`border p-4 sm:p-5 ${alert ? "border-amber-400/35 bg-amber-400/10" : "border-white/10 bg-[#111418]"}`}><small className="text-[9px] font-black uppercase tracking-[.14em] text-neutral-500">{label}</small><strong className="mt-2 block text-3xl font-black">{value}</strong></div>;
}

function Tab({ active, children, onClick }) {
  return <button onClick={onClick} className={`border-b-2 px-4 py-3 text-sm font-black ${active ? "border-[#ef4538] text-white" : "border-transparent text-neutral-500"}`}>{children}</button>;
}

function Badge({ children, tone = "red" }) {
  const styles = tone === "green" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
    : tone === "amber" ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
      : tone === "muted" ? "border-white/10 bg-white/5 text-neutral-400"
        : "border-[#ef4538]/30 bg-[#ef4538]/10 text-[#ff756c]";
  return <span className={`inline-flex border px-2.5 py-1 text-[9px] font-black uppercase tracking-[.13em] ${styles}`}>{children}</span>;
}

function DeskField({ label, value, onChange }) {
  return <label className="text-[9px] font-black uppercase tracking-[.12em] text-neutral-500">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full border border-white/10 bg-[#090b0e] px-3 text-base font-normal normal-case tracking-normal text-white outline-none" /></label>;
}

function DeskSelect({ label, value, onChange, options }) {
  return <label className="text-[9px] font-black uppercase tracking-[.12em] text-neutral-500">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full border border-white/10 bg-[#090b0e] px-3 text-base font-semibold normal-case tracking-normal text-white outline-none">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

function Data({ term, value }) {
  return <div><dt className="text-[9px] font-black uppercase tracking-[.13em] text-neutral-500">{term}</dt><dd className="mt-1.5 break-words text-sm leading-5 text-neutral-300">{value}</dd></div>;
}

function Empty({ text }) {
  return <div className="border border-white/10 bg-[#111418] px-6 py-16 text-center"><UserRound className="mx-auto text-neutral-700" /><h2 className="mt-4 text-xl font-black">{text}</h2></div>;
}
