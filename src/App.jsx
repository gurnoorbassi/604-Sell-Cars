import React, { useState, useEffect } from "react";
import {
  Plus, X, Pencil, Trash2, Car, Image as ImageIcon, Check,
  RotateCcw, Search, Flame, Sparkles, FileText, ExternalLink,
} from "lucide-react";
import SEED from "./data/seed.json";

const expand = (s) => ({
  id: s.id,
  title: s.t,
  stock: s.sk || "",
  price: s.p || "",
  kms: s.k || "",
  dealership: s.d || "",
  bodyType: s.b || "",
  fuelTags: s.f || [],
  labels: s.l || [],
  description: s.de || "",
  carfax: s.carfax || (s.cx ? "on-file" : ""),
  trelloUrl: s.trelloUrl || (/^https:\/\/trello\.com\/c\//.test(s.t) ? s.t : ""),
  photoCount: s.pc || 0,
  photos: s.photos || [],
  videos: s.videos || [],
  hot: !!s.h,
  isNew: !!s.n,
  status: s.s ? "sold" : "live",
});

const DEALERSHIPS = ["Karma Autos", "SkyHigh Auto", "Mainland Motors", "Lougheed Hyundai"];
const BODY_TYPES = ["Sedan", "SUV", "Coupe", "Truck", "Van", "Offroad"];
const FUEL_TAGS = ["Hybrid", "Electric", "Diesel", "Manual", "Performance", "Luxury", "Brand New"];
const LABELS = ["BONUS PAY", "PARTNER LOT", "GOOD MEDIA", "HAS CARFAX"];
const LABEL_COLORS = {
  "BONUS PAY": "bg-green-600", "PARTNER LOT": "bg-yellow-600",
  "GOOD MEDIA": "bg-blue-600", "HAS CARFAX": "bg-teal-600",
};
const tierFor = (p) => {
  const n = parseFloat(String(p).replace(/[^0-9.]/g, ""));
  if (!n) return null;
  if (n < 10000) return "<$10K";
  if (n < 20000) return "<$20K";
  if (n < 30000) return "<$30K";
  if (n < 50000) return "$30-50K";
  if (n < 100000) return "$50-100K";
  return "High End";
};
const TIERS = ["<$10K", "<$20K", "<$30K", "$30-50K", "$50-100K", "High End"];

const STORAGE_KEY = "sellscars-board-v4";
const emptyForm = {
  id: null, title: "", stock: "", price: "", kms: "",
  dealership: "", bodyType: "", fuelTags: [], labels: [],
  description: "", carfax: "", trelloUrl: "", photoCount: 0, photos: [], videos: [],
  hot: false, isNew: false, status: "live",
};

export default function SellsCarsBoard() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("live");
  const [f, setF] = useState({ dealership: null, body: null, fuel: null, tier: null, flag: null });
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    (() => {
      let loaded = null;
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) loaded = JSON.parse(stored);
      } catch (e) { console.warn("Saved inventory could not be read; loading the seed instead.", e); }
      if (loaded && loaded.length) {
        setCars(loaded);
      } else {
        const seeded = SEED.map(expand);
        setCars(seeded);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded)); } catch (e) { console.warn("Seed could not be cached.", e); }
      }
      setLoading(false);
    })();
  }, []);

  const persist = (next) => {
    setCars(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch (e) { console.error("Save failed:", e); }
  };

  const visible = cars.filter((c) => {
    if (tab === "sold" ? c.status !== "sold" : c.status !== "live") return false;
    if (f.dealership && c.dealership !== f.dealership) return false;
    if (f.body && c.bodyType !== f.body) return false;
    if (f.fuel && !c.fuelTags.includes(f.fuel)) return false;
    if (f.tier && tierFor(c.price) !== f.tier) return false;
    if (f.flag === "hot" && !c.hot) return false;
    if (f.flag === "new" && !c.isNew) return false;
    if (search.trim() && !(c.title + " " + c.stock).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const liveCount = cars.filter((c) => c.status === "live").length;
  const soldCount = cars.filter((c) => c.status === "sold").length;
  const activeFilters = Object.values(f).filter(Boolean).length;

  const markSold = (id) => {
    persist(cars.map((c) => c.id === id ? { ...c, status: "sold", hot: false, isNew: false } : c));
    setDetail(null);
  };
  const relist = (id) => { persist(cars.map((c) => c.id === id ? { ...c, status: "live" } : c)); setDetail(null); };
  const remove = (id) => { persist(cars.filter((c) => c.id !== id)); setDetail(null); };

  const openAdd = () => { setForm(emptyForm); setModalOpen(true); };
  const openEdit = (car) => { setForm({ ...car }); setDetail(null); setModalOpen(true); };
  const saveCar = () => {
    if (!form.title.trim()) return;
    const next = form.id
      ? cars.map((c) => (c.id === form.id ? { ...form } : c))
      : [{ ...form, id: Date.now().toString(), isNew: true }, ...cars];
    persist(next);
    setModalOpen(false);
  };
  const toggleIn = (key, val) =>
    setForm((fm) => ({
      ...fm,
      [key]: fm[key].includes(val) ? fm[key].filter((x) => x !== val) : [...fm[key], val],
    }));

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      <header className="sticky top-0 z-20 bg-neutral-950/95 backdrop-blur border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 pt-3 pb-2 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-red-600 grid place-items-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold tracking-tight leading-none">604SELLSCARS</h1>
              <p className="text-[11px] text-neutral-500 leading-none mt-1">Ad inventory</p>
            </div>
          </div>
          <div className="flex bg-neutral-900 rounded-lg p-0.5 border border-neutral-800">
            <button onClick={() => setTab("live")}
              className={`px-3.5 py-1.5 text-sm font-semibold rounded-md ${tab === "live" ? "bg-neutral-100 text-neutral-950" : "text-neutral-400"}`}>
              Live {liveCount}
            </button>
            <button onClick={() => setTab("sold")}
              className={`px-3.5 py-1.5 text-sm font-semibold rounded-md ${tab === "sold" ? "bg-red-500 text-white" : "text-neutral-400"}`}>
              Sold {soldCount}
            </button>
          </div>
          <div className="relative ml-auto">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search or stock #"
              className="bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-2 text-sm w-44 sm:w-56 focus:outline-none focus:border-neutral-600" />
          </div>
          <button onClick={openAdd}
            className="bg-red-600 hover:bg-red-500 text-white font-semibold text-sm px-4 py-2 rounded-lg flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add car
          </button>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-2.5 space-y-1.5">
          <FilterRow label="Lot" options={DEALERSHIPS} value={f.dealership} onPick={(v) => setF({ ...f, dealership: v })} />
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            <FilterRow inline label="Type" options={BODY_TYPES} value={f.body} onPick={(v) => setF({ ...f, body: v })} />
            <span className="text-neutral-800 self-center">·</span>
            <FilterRow inline label="Fuel" options={FUEL_TAGS} value={f.fuel} onPick={(v) => setF({ ...f, fuel: v })} />
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar items-center">
            <FilterRow inline label="Price" options={TIERS} value={f.tier} onPick={(v) => setF({ ...f, tier: v })} />
            <span className="text-neutral-800">·</span>
            <Pill active={f.flag === "hot"} onClick={() => setF({ ...f, flag: f.flag === "hot" ? null : "hot" })}>
              <Flame className="w-3 h-3" /> Hot
            </Pill>
            <Pill active={f.flag === "new"} onClick={() => setF({ ...f, flag: f.flag === "new" ? null : "new" })}>
              <Sparkles className="w-3 h-3" /> New
            </Pill>
            {activeFilters > 0 && (
              <button onClick={() => setF({ dealership: null, body: null, fuel: null, tier: null, flag: null })}
                className="text-[11px] text-red-400 hover:text-red-300 font-medium whitespace-nowrap ml-1">
                Clear {activeFilters}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5">
        {loading ? (
          <p className="text-neutral-500 text-sm text-center py-24">Loading {SEED.length} cars…</p>
        ) : visible.length === 0 ? (
          <div className="text-center py-24">
            <p className="font-medium text-neutral-300">No cars match.</p>
            <p className="text-sm text-neutral-500 mt-1">{activeFilters > 0 ? "Try clearing a filter." : ""}</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-neutral-500 mb-3">{visible.length} car{visible.length !== 1 ? "s" : ""}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {visible.map((car) => (
                <CarCard key={car.id} car={car} onOpen={() => setDetail(car)} onSold={() => markSold(car.id)} />
              ))}
            </div>
          </>
        )}
      </main>

      {detail && (
        <DetailPanel car={detail} onClose={() => setDetail(null)}
          onSold={() => markSold(detail.id)} onRelist={() => relist(detail.id)}
          onEdit={() => openEdit(detail)} onDelete={() => remove(detail.id)} />
      )}
      {modalOpen && (
        <EditModal form={form} setForm={setForm} toggleIn={toggleIn}
          onSave={saveCar} onClose={() => setModalOpen(false)} />
      )}
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}`}</style>
    </div>
  );
}

const Pill = ({ active, onClick, children }) => (
  <button onClick={onClick}
    className={`whitespace-nowrap text-[11px] px-2.5 py-1 rounded-full border font-medium flex items-center gap-1 transition-colors ${
      active ? "bg-red-600 border-red-600 text-white" : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-600"}`}>
    {children}
  </button>
);

const FilterRow = ({ label, options, value, onPick, inline }) => (
  <div className={`flex gap-1.5 items-center ${inline ? "" : "overflow-x-auto no-scrollbar"}`}>
    <span className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold shrink-0 w-8">{label}</span>
    {options.map((o) => (
      <Pill key={o} active={value === o} onClick={() => onPick(value === o ? null : o)}>{o}</Pill>
    ))}
  </div>
);

function CarCard({ car, onOpen, onSold }) {
  const sold = car.status === "sold";
  const tier = tierFor(car.price);
  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 hover:border-neutral-600 overflow-hidden transition-colors flex flex-col">
      <button onClick={onOpen} className="text-left flex-1">
        {car.photos?.[0] && (
          <img src={car.photos[0]} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover bg-neutral-800" />
        )}
        <div className="p-2.5">
          <div className="flex items-start gap-1.5">
            {car.hot && !sold && <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />}
            {car.isNew && !sold && <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />}
            <h3 className={`font-semibold text-[13px] leading-snug line-clamp-2 ${sold ? "text-neutral-500 line-through decoration-red-500/60" : ""}`}>
              {car.title}
            </h3>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className={`font-bold text-sm ${sold ? "text-neutral-600" : "text-red-400"}`}>
              {car.price ? `$${car.price}` : "—"}
            </span>
            {car.kms && <span className="text-[11px] text-neutral-500">{car.kms} km</span>}
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {car.dealership && <Tag>{car.dealership}</Tag>}
            {car.bodyType && <Tag>{car.bodyType}</Tag>}
            {tier && <Tag>{tier}</Tag>}
            {car.photoCount > 0 && (
              <span className="text-[10px] text-neutral-500 flex items-center gap-0.5 px-1">
                <ImageIcon className="w-2.5 h-2.5" />{car.photoCount}
              </span>
            )}
          </div>
          {car.labels.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {car.labels.map((l) => (
                <span key={l} title={l} className={`${LABEL_COLORS[l]} h-1.5 flex-1 rounded-full ${sold ? "opacity-30" : ""}`} />
              ))}
            </div>
          )}
        </div>
      </button>
      <div className="px-2.5 pb-2.5">
        {sold ? (
          <span className="block text-center text-[10px] font-bold text-red-500/70 tracking-widest border border-red-500/20 rounded-md py-1">SOLD</span>
        ) : (
          <button onClick={onSold}
            className="w-full text-[11px] font-bold bg-neutral-800 hover:bg-red-600 text-neutral-400 hover:text-white py-1.5 rounded-md flex items-center justify-center gap-1 transition-colors">
            <Check className="w-3 h-3" /> Mark sold
          </button>
        )}
      </div>
    </div>
  );
}

const Tag = ({ children }) => (
  <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-medium">{children}</span>
);

function DetailPanel({ car, onClose, onSold, onRelist, onEdit, onDelete }) {
  const sold = car.status === "sold";
  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div className="bg-neutral-900 w-full max-w-md h-full overflow-y-auto border-l border-neutral-800" onClick={(e) => e.stopPropagation()}>
        <div className="p-4">
          <button onClick={onClose} className="float-right text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
          {car.stock && <p className="text-[11px] text-neutral-500 font-mono">#{car.stock}</p>}
          <h2 className="font-bold text-lg leading-tight mt-0.5 pr-8">{car.title}</h2>
          <div className="flex items-baseline gap-3 mt-1 flex-wrap">
            <span className="text-red-400 font-extrabold text-xl">{car.price ? `$${car.price}` : ""}</span>
            {car.kms && <span className="text-sm text-neutral-400">{car.kms} km</span>}
            {tierFor(car.price) && <Tag>{tierFor(car.price)}</Tag>}
          </div>
          {sold && <p className="mt-2 inline-block text-xs font-bold text-red-500 border border-red-500/40 rounded px-2 py-0.5 tracking-widest">SOLD</p>}
          {car.labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {car.labels.map((l) => (
                <span key={l} className={`${LABEL_COLORS[l]} text-white text-[10px] font-bold px-2 py-1 rounded`}>{l}</span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {car.dealership && <Tag>{car.dealership}</Tag>}
            {car.bodyType && <Tag>{car.bodyType}</Tag>}
            {car.fuelTags.map((t) => <Tag key={t}>{t}</Tag>)}
            {car.photoCount > 0 && <Tag>{car.photoCount} photos in Trello</Tag>}
          </div>
          {car.photos?.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              {car.photos.slice(0, 8).map((photo, index) => (
                <a key={photo} href={photo} target="_blank" rel="noreferrer" className="block">
                  <img src={photo} alt={`${car.title} photo ${index + 1}`} loading="lazy"
                    className="w-full aspect-[4/3] object-cover rounded-lg bg-neutral-800" />
                </a>
              ))}
            </div>
          )}
          {car.carfax && car.carfax !== "on-file" ? (
            <a href={car.carfax} target="_blank" rel="noreferrer"
              className="mt-4 flex items-center gap-2 text-sm text-teal-400 bg-neutral-800/60 hover:bg-neutral-800 rounded-lg px-3 py-2">
              <FileText className="w-4 h-4" /> Open CARFAX report <ExternalLink className="w-3.5 h-3.5 ml-auto" />
            </a>
          ) : car.carfax ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-amber-300 bg-neutral-800/60 rounded-lg px-3 py-2">
              <FileText className="w-4 h-4" /> CARFAX flagged; URL not included in the import
            </p>
          ) : null}
          {car.trelloUrl && (
            <a href={car.trelloUrl} target="_blank" rel="noreferrer"
              className="mt-2 flex items-center gap-2 text-sm text-blue-400 bg-neutral-800/60 hover:bg-neutral-800 rounded-lg px-3 py-2">
              Open Trello source <ExternalLink className="w-3.5 h-3.5 ml-auto" />
            </a>
          )}
          {car.description && (
            <p className="text-sm text-neutral-300 whitespace-pre-wrap mt-4 leading-relaxed">{car.description}…</p>
          )}
          <div className="flex gap-2 mt-6 pb-4">
            {sold ? (
              <button onClick={onRelist} className="flex-1 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm font-semibold flex items-center justify-center gap-1.5">
                <RotateCcw className="w-4 h-4" /> Relist
              </button>
            ) : (
              <button onClick={onSold} className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" /> Mark SOLD
              </button>
            )}
            <button onClick={onEdit} className="px-4 rounded-lg bg-neutral-800 hover:bg-neutral-700"><Pencil className="w-4 h-4" /></button>
            <button onClick={onDelete} className="px-4 rounded-lg bg-neutral-800 hover:bg-red-500/20 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditModal({ form, setForm, toggleIn, onSave, onClose }) {
  const tier = tierFor(form.price);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-xl my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h2 className="font-bold">{form.id ? "Edit car" : "Add car"}</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-3">
            <F label="Car" className="flex-1">
              <input className="inp" value={form.title} placeholder="2018 Mercedes Benz S63 AMG"
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </F>
            <F label="Stock #" className="w-28">
              <input className="inp" value={form.stock} placeholder="363882"
                onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </F>
          </div>
          <div className="flex gap-3">
            <F label={`Price${tier ? ` → ${tier} (auto)` : ""}`} className="flex-1">
              <input className="inp" value={form.price} placeholder="82,888"
                onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </F>
            <F label="KMs" className="flex-1">
              <input className="inp" value={form.kms} placeholder="62,XXX"
                onChange={(e) => setForm({ ...form, kms: e.target.value })} />
            </F>
          </div>
          <F label="Dealership lot">
            <div className="flex gap-1.5 flex-wrap">
              {DEALERSHIPS.map((d) => (
                <Choice key={d} on={form.dealership === d}
                  onClick={() => setForm({ ...form, dealership: form.dealership === d ? "" : d })}>{d}</Choice>
              ))}
            </div>
          </F>
          <F label="Body type">
            <div className="flex gap-1.5 flex-wrap">
              {BODY_TYPES.map((b) => (
                <Choice key={b} on={form.bodyType === b}
                  onClick={() => setForm({ ...form, bodyType: form.bodyType === b ? "" : b })}>{b}</Choice>
              ))}
            </div>
          </F>
          <F label="Fuel / drivetrain tags">
            <div className="flex gap-1.5 flex-wrap">
              {FUEL_TAGS.map((t) => (
                <Choice key={t} on={form.fuelTags.includes(t)} onClick={() => toggleIn("fuelTags", t)}>{t}</Choice>
              ))}
            </div>
          </F>
          <F label="Labels">
            <div className="flex gap-1.5 flex-wrap">
              {LABELS.map((l) => (
                <button key={l} onClick={() => toggleIn("labels", l)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded ${form.labels.includes(l) ? `${LABEL_COLORS[l]} text-white` : "bg-neutral-800 text-neutral-500"}`}>
                  {l}
                </button>
              ))}
            </div>
          </F>
          <div className="flex gap-4">
            <Toggle on={form.hot} onClick={() => setForm({ ...form, hot: !form.hot })} icon={<Flame className="w-3.5 h-3.5" />}>Hot sell</Toggle>
            <Toggle on={form.isNew} onClick={() => setForm({ ...form, isNew: !form.isNew })} icon={<Sparkles className="w-3.5 h-3.5" />}>New arrival</Toggle>
          </div>
          <F label="Description / ad copy">
            <textarea className="inp resize-none" rows={4} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </F>
          <F label="CARFAX report URL">
            <input className="inp" value={form.carfax === "on-file" ? "" : form.carfax}
              placeholder="https://vhr.carfax.ca/..."
              onChange={(e) => setForm({ ...form, carfax: e.target.value })} />
          </F>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-neutral-800">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm font-medium">Cancel</button>
          <button onClick={onSave} disabled={!form.title.trim()}
            className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-bold">
            {form.id ? "Save changes" : "Add to board"}
          </button>
        </div>
      </div>
      <style>{`.inp{width:100%;margin-top:4px;background:#171717;border:1px solid #333;border-radius:8px;padding:8px 12px;font-size:14px;color:#f5f5f5;outline:none}.inp:focus{border-color:#666}`}</style>
    </div>
  );
}

const F = ({ label, children, className = "" }) => (
  <div className={className}>
    <label className="text-xs text-neutral-400 font-medium">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);
const Choice = ({ on, onClick, children }) => (
  <button onClick={onClick}
    className={`text-xs px-2.5 py-1 rounded-full border font-medium ${on ? "bg-neutral-100 border-neutral-100 text-neutral-950" : "bg-neutral-800 border-neutral-700 text-neutral-400"}`}>
    {children}
  </button>
);
const Toggle = ({ on, onClick, icon, children }) => (
  <button onClick={onClick}
    className={`text-xs px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 ${on ? "bg-orange-500/15 border-orange-500/50 text-orange-400" : "bg-neutral-800 border-neutral-700 text-neutral-500"}`}>
    {icon} {children}
  </button>
);
