import React, { useState, useEffect } from "react";
import {
  Plus, X, Pencil, Trash2, Car, Image as ImageIcon, Check,
  RotateCcw, Search, Flame, Sparkles, FileText, ExternalLink, LogOut, Upload, LoaderCircle,
} from "lucide-react";
import AuthScreen from "./AuthScreen";
import { supabase, supabasePublishableKey } from "./lib/supabase";

const rowToCar = (row, signedUrls) => {
  const media = [...(row.vehicle_media || [])].sort((a, b) => a.sort_order - b.sort_order);
  const photos = media.filter((item) => item.kind === "image").map((item) =>
    item.storage_path ? signedUrls.get(item.storage_path) : item.source_url,
  ).filter(Boolean);
  const videos = media.filter((item) => item.kind === "video").map((item) =>
    item.storage_path ? signedUrls.get(item.storage_path) : item.source_url,
  ).filter(Boolean);
  return {
    id: row.id, title: row.title, stock: row.stock, price: row.price, kms: row.kms,
    dealership: row.dealership, bodyType: row.body_type, fuelTags: row.fuel_tags || [],
    labels: row.labels || [], description: row.description, carfax: row.carfax_url,
    trelloUrl: row.trello_url, photoCount: row.photo_count, photos, videos,
    manualPhotos: media.filter((item) => item.kind === "image" && !item.storage_path).map((item) => item.source_url),
    storagePaths: media.map((item) => item.storage_path).filter(Boolean),
    storedMediaCount: media.filter((item) => item.storage_path).length,
    hot: row.hot, isNew: row.is_new, status: row.status,
  };
};

const carToRow = (car, userId) => ({
  id: car.id,
  title: car.title.trim(),
  stock: car.stock || "",
  price: car.price || "",
  kms: car.kms || "",
  dealership: car.dealership || "",
  body_type: car.bodyType || "",
  fuel_tags: car.fuelTags || [],
  labels: car.labels || [],
  description: car.description || "",
  carfax_url: car.carfax === "on-file" ? "" : (car.carfax || ""),
  trello_url: car.trelloUrl || "",
  photo_count: Number(car.photoCount) || 0,
  hot: !!car.hot,
  is_new: !!car.isNew,
  status: car.status || "live",
  updated_at: new Date().toISOString(),
  updated_by: userId,
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
const emptyForm = {
  id: null, title: "", stock: "", price: "", kms: "",
  dealership: "", bodyType: "", fuelTags: [], labels: [],
  description: "", carfax: "", trelloUrl: "", photoCount: 0, photos: [], videos: [],
  manualPhotos: [], uploadFiles: [], storedMediaCount: 0,
  hot: false, isNew: false, status: "live",
};

export default function SellsCarsBoard() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appError, setAppError] = useState("");
  const [tab, setTab] = useState("live");
  const [f, setF] = useState({ dealership: null, body: null, fuel: null, tier: null, flag: null });
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadCars = async () => {
    if (!session) return;
    setLoading(true);
    setAppError("");

    const { data: membership, error: membershipError } = await supabase
      .from("team_members")
      .select("role")
      .maybeSingle();
    if (membershipError || !membership) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }
    setAccessDenied(false);

    const { data: rows, error } = await supabase
      .from("inventory")
      .select("*, vehicle_media(*)")
      .order("updated_at", { ascending: false });
    if (error) {
      setAppError(error.message);
      setLoading(false);
      return;
    }

    const storagePaths = rows.flatMap((row) => row.vehicle_media || [])
      .map((item) => item.storage_path)
      .filter(Boolean);
    const signedUrls = new Map();
    if (storagePaths.length) {
      const { data: signed, error: signingError } = await supabase.storage
        .from("vehicle-media")
        .createSignedUrls(storagePaths, 3600);
      if (signingError) setAppError(signingError.message);
      (signed || []).forEach((item) => {
        if (item.signedUrl) signedUrls.set(item.path, item.signedUrl);
      });
    }
    setCars(rows.map((row) => rowToCar(row, signedUrls)));
    setLoading(false);
  };

  useEffect(() => {
    if (session) loadCars();
    else {
      setCars([]);
      setLoading(false);
      setAccessDenied(false);
    }
  }, [session]);

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

  const updateStatus = async (id, values) => {
    const { error } = await supabase.from("inventory").update({
      ...values,
      updated_at: new Date().toISOString(),
      updated_by: session.user.id,
    }).eq("id", id);
    if (error) setAppError(error.message);
    else {
      const uiValues = { ...values };
      if (Object.hasOwn(uiValues, "is_new")) {
        uiValues.isNew = uiValues.is_new;
        delete uiValues.is_new;
      }
      setCars((current) => current.map((car) => car.id === id ? { ...car, ...uiValues } : car));
    }
  };

  const markSold = async (id) => {
    await updateStatus(id, { status: "sold", hot: false, is_new: false });
    setDetail(null);
  };
  const relist = async (id) => { await updateStatus(id, { status: "live" }); setDetail(null); };
  const remove = async (id) => {
    const car = cars.find((item) => item.id === id);
    if (car?.storagePaths?.length) {
      const { error: storageError } = await supabase.storage.from("vehicle-media")
        .remove(car.storagePaths);
      if (storageError) {
        setAppError(storageError.message);
        return;
      }
    }
    const { error } = await supabase.from("inventory").delete().eq("id", id);
    if (error) setAppError(error.message);
    else setCars((current) => current.filter((car) => car.id !== id));
    setDetail(null);
  };

  const openAdd = () => { setForm({ ...emptyForm, uploadFiles: [] }); setModalOpen(true); };
  const openEdit = (car) => { setForm({ ...car, uploadFiles: [] }); setDetail(null); setModalOpen(true); };
  const saveCar = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setAppError("");
    const id = form.id || crypto.randomUUID();
    const manualPhotos = form.manualPhotos || [];
    const uploadFiles = form.uploadFiles || [];
    const oversizedFile = uploadFiles.find((file) => file.size > 10 * 1024 * 1024);
    if (oversizedFile) {
      setAppError(`${oversizedFile.name} is larger than the 10 MB per-file upload limit.`);
      setSaving(false);
      return;
    }
    const record = {
      ...form,
      id,
      isNew: form.id ? form.isNew : true,
      photoCount: (form.storedMediaCount || 0) + manualPhotos.length + uploadFiles.length,
    };
    const { error: saveError } = await supabase.from("inventory").upsert(carToRow(record, session.user.id));
    if (saveError) {
      setAppError(saveError.message);
      setSaving(false);
      return;
    }

    const { error: deleteMediaError } = await supabase.from("vehicle_media")
      .delete().eq("vehicle_id", id).is("storage_path", null);
    if (deleteMediaError) {
      setAppError(deleteMediaError.message);
      setSaving(false);
      return;
    }
    if (manualPhotos.length) {
      const { error: mediaError } = await supabase.from("vehicle_media").insert(
        manualPhotos.map((sourceUrl, index) => ({
          vehicle_id: id,
          kind: "image",
          source_url: sourceUrl,
          sort_order: (form.storedMediaCount || 0) + index,
        })),
      );
      if (mediaError) {
        setAppError(mediaError.message);
        setSaving(false);
        return;
      }
    }

    for (const [index, file] of uploadFiles.entries()) {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const storagePath = `${id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("vehicle-media")
        .upload(storagePath, file, { contentType: file.type || "image/jpeg", upsert: false });
      if (uploadError) {
        setAppError(uploadError.message);
        setSaving(false);
        return;
      }
      const { error: mediaRowError } = await supabase.from("vehicle_media").insert({
        vehicle_id: id,
        kind: file.type.startsWith("video/") ? "video" : "image",
        storage_path: storagePath,
        source_url: "",
        sort_order: (form.storedMediaCount || 0) + manualPhotos.length + index,
        mime_type: file.type || null,
      });
      if (mediaRowError) {
        setAppError(mediaRowError.message);
        setSaving(false);
        return;
      }
    }

    await loadCars();
    setSaving(false);
    setModalOpen(false);
  };
  const toggleIn = (key, val) =>
    setForm((fm) => ({
      ...fm,
      [key]: fm[key].includes(val) ? fm[key].filter((x) => x !== val) : [...fm[key], val],
    }));

  if (!authReady) return <div className="min-h-screen bg-neutral-950 grid place-items-center text-sm text-neutral-500">Connecting securely…</div>;
  if (!session) return <AuthScreen />;
  if (accessDenied) return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 grid place-items-center p-5">
      <section className="max-w-md rounded-2xl border border-amber-500/30 bg-neutral-900 p-6 text-center">
        <h1 className="text-lg font-bold">This email is not approved</h1>
        <p className="mt-2 text-sm text-neutral-400">Ask the inventory owner to add {session.user.email} to the team allowlist.</p>
        <button onClick={() => supabase.auth.signOut()} className="mt-5 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-semibold">Sign out</button>
      </section>
    </main>
  );

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
          <button onClick={() => supabase.auth.signOut()} title={`Sign out ${session.user.email}`}
            className="rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-neutral-400 hover:text-white">
            <LogOut className="h-4 w-4" />
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
        {appError && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{appError}</p>}
        {loading ? (
          <p className="text-neutral-500 text-sm text-center py-24">Loading shared inventory…</p>
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
        <EditModal form={form} setForm={setForm} toggleIn={toggleIn} session={session}
          saving={saving} onSave={saveCar} onClose={() => setModalOpen(false)} />
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

function EditModal({ form, setForm, toggleIn, session, saving, onSave, onClose }) {
  const tier = tierFor(form.price);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [descriptionError, setDescriptionError] = useState("");
  const [fileError, setFileError] = useState("");
  const generateDescription = async () => {
    if (!form.title.trim() || generatingDescription) return;
    setGeneratingDescription(true);
    setDescriptionError("");
    try {
      const response = await fetch("/api/generate-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "X-Supabase-Publishable-Key": supabasePublishableKey,
        },
        body: JSON.stringify({
          title: form.title,
          price: form.price,
          kms: form.kms,
          bodyType: form.bodyType,
          fuelTags: form.fuelTags,
          notes: form.description,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.description !== "string" || !result.description.trim()) {
        throw new Error(result.error || "Description generation failed. Please try again.");
      }
      setForm((current) => ({ ...current, description: result.description }));
    } catch (error) {
      setDescriptionError(error.message || "Description generation failed. Please try again.");
    } finally {
      setGeneratingDescription(false);
    }
  };
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
          <div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs text-neutral-400 font-medium">Description / ad copy</label>
              <button type="button" onClick={generateDescription}
                disabled={!form.title.trim() || generatingDescription}
                className="flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40">
                {generatingDescription ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {generatingDescription ? "Generating..." : "Generate Description with AI"}
              </button>
            </div>
            <textarea className="inp mt-1 resize-none" rows={4} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">Add key features or notes here first; AI uses the existing text as source material and replaces it with editable ad copy.</p>
            {descriptionError && <p className="mt-1.5 text-xs text-red-300">{descriptionError}</p>}
          </div>
          <F label="CARFAX report URL">
            <input className="inp" value={form.carfax === "on-file" ? "" : form.carfax}
              placeholder="https://vhr.carfax.ca/..."
              onChange={(e) => setForm({ ...form, carfax: e.target.value })} />
          </F>
          <F label="Photo URLs (one per line)">
            <textarea className="inp resize-none" rows={4} value={(form.manualPhotos || []).join("\n")}
              placeholder={"https://your-storage.com/car/front.jpg\nhttps://your-storage.com/car/interior.jpg"}
              onChange={(e) => {
                const manualPhotos = e.target.value.split("\n").map((url) => url.trim()).filter(Boolean);
                setForm({ ...form, manualPhotos });
              }} />
            <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">Existing Trello previews remain attached until they are migrated into permanent storage.</p>
          </F>
          <F label="Upload photos or videos">
            <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-700 bg-neutral-800/50 px-3 py-4 text-sm text-neutral-400 hover:border-neutral-500 hover:text-white">
              <Upload className="h-4 w-4" />
              {form.uploadFiles?.length ? `${form.uploadFiles.length} file(s) selected` : "Choose files from this device"}
              <input className="hidden" type="file" accept="image/*,video/mp4,video/quicktime" multiple
                onChange={(event) => {
                  const selectedFiles = Array.from(event.target.files || []);
                  const oversizedFiles = selectedFiles.filter((file) => file.size > 10 * 1024 * 1024);
                  setFileError(oversizedFiles.length ? `${oversizedFiles.map((file) => file.name).join(", ")} exceeded 10 MB and was not selected.` : "");
                  setForm({ ...form, uploadFiles: selectedFiles.filter((file) => file.size <= 10 * 1024 * 1024) });
                }} />
            </label>
            <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">No fixed file-count limit in the app. Maximum 10 MB per photo or video.</p>
            {fileError && <p className="mt-1.5 text-xs text-red-300">{fileError}</p>}
          </F>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-neutral-800">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm font-medium">Cancel</button>
          <button onClick={onSave} disabled={saving || !form.title.trim()}
            className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-bold">
            {saving ? "Saving…" : form.id ? "Save changes" : "Add to board"}
          </button>
        </div>
      </div>
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
