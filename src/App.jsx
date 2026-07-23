import React, { useState, useEffect } from "react";
import * as tus from "tus-js-client";
import {
  Plus, X, Pencil, Trash2, Car, Image as ImageIcon, Check,
  RotateCcw, Search, Flame, Sparkles, FileText, ExternalLink, LogOut, Upload, LoaderCircle,
  ShieldCheck, Users,
} from "lucide-react";
import AuthScreen, { PasswordUpdateScreen } from "./AuthScreen";
import { chunkArray, tierFor } from "./lib/inventory";
import { supabase, supabasePublishableKey, supabaseUrl } from "./lib/supabase";

const MAX_UPLOAD_MB = 50;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const RESUMABLE_UPLOAD_THRESHOLD = 6 * 1024 * 1024;
const SUPABASE_PROJECT_REF = new URL(supabaseUrl).hostname.split(".")[0];

const uploadResumableFile = (file, storagePath, session, onProgress) => new Promise((resolve, reject) => {
  const upload = new tus.Upload(file, {
    endpoint: `https://${SUPABASE_PROJECT_REF}.storage.supabase.co/storage/v1/upload/resumable`,
    retryDelays: [0, 3000, 5000, 10000],
    headers: { authorization: `Bearer ${session.access_token}` },
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    chunkSize: 6 * 1024 * 1024,
    metadata: {
      bucketName: "vehicle-media",
      objectName: storagePath,
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
    },
    onError: reject,
    onProgress: (bytesUploaded, bytesTotal) => onProgress(bytesTotal ? bytesUploaded / bytesTotal : 0),
    onSuccess: resolve,
  });

  upload.findPreviousUploads().then((previousUploads) => {
    if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
    upload.start();
  }).catch(reject);
});

const rowToCar = (row, signedUrls) => {
  const media = [...(row.vehicle_media || [])].sort((a, b) => a.sort_order - b.sort_order);
  const hasCarfaxUrl = Boolean(row.carfax_url?.trim());
  const labels = (row.labels || []).filter((label) => label !== "HAS CARFAX");
  if (hasCarfaxUrl) labels.push("HAS CARFAX");
  const photos = media.filter((item) => item.kind === "image").map((item) =>
    item.storage_path ? signedUrls.get(item.storage_path) : (signedUrls.get(item.source_url) || item.source_url),
  ).filter(Boolean);
  const videos = media.filter((item) => item.kind === "video").map((item) =>
    item.storage_path ? signedUrls.get(item.storage_path) : (signedUrls.get(item.source_url) || item.source_url),
  ).filter(Boolean);
  return {
    id: row.id, title: row.title, stock: row.stock, price: row.price, kms: row.kms,
    dealership: row.dealership, bodyType: row.body_type, fuelTags: row.fuel_tags || [],
    labels, description: row.description, carfax: row.carfax_url,
    trelloUrl: row.trello_url, photoCount: row.photo_count, photos, videos,
    manualPhotos: media.filter((item) => item.kind === "image" && !item.storage_path).map((item) => item.source_url),
    storagePaths: media.map((item) => item.storage_path).filter(Boolean),
    storedMediaCount: media.filter((item) => item.storage_path).length,
    failedMediaCount: media.filter((item) => item.migration_error).length,
    updatedAt: row.updated_at,
    version: row.version || 1,
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
const BODY_TYPES = ["Sedan", "SUV", "Coupe", "Truck", "Van", "Minivan", "Hatchback", "Wagon", "Convertible", "Offroad"];
const FUEL_TAGS = ["Gasoline", "Hybrid", "Electric", "Diesel", "Automatic", "Manual", "AWD", "4WD", "FWD", "Performance", "Luxury", "Brand New"];
const LABELS = ["BONUS PAY", "PARTNER LOT", "GOOD MEDIA", "HAS CARFAX"];
const LABEL_COLORS = {
  "BONUS PAY": "bg-green-600", "PARTNER LOT": "bg-yellow-600",
  "GOOD MEDIA": "bg-blue-600", "HAS CARFAX": "bg-teal-600",
};
const TIERS = ["<$10K", "<$20K", "<$30K", "$30-50K", "$50-100K", "High End"];
const emptyForm = {
  id: null, title: "", stock: "", price: "", kms: "",
  dealership: "", bodyType: "", fuelTags: [], labels: [],
  description: "", carfax: "", trelloUrl: "", photoCount: 0, photos: [], videos: [],
  manualPhotos: [], uploadFiles: [], storedMediaCount: 0,
  updatedAt: null, version: 1,
  hot: false, isNew: false, status: "live",
};

export default function SellsCarsBoard() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [membershipRole, setMembershipRole] = useState(null);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [appError, setAppError] = useState("");
  const [tab, setTab] = useState("live");
  const [f, setF] = useState({ dealership: null, body: null, fuel: null, tier: null, flag: null });
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [detail, setDetail] = useState(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamEmail, setTeamEmail] = useState("");
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [teamNotice, setTeamNotice] = useState("");
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [migrationStarting, setMigrationStarting] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(48);
  const isOwner = membershipRole === "owner";
  const canEdit = membershipRole === "owner" || membershipRole === "admin";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
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
      .eq("email", session.user.email.toLowerCase())
      .maybeSingle();
    if (membershipError || !membership) {
      setMembershipRole(null);
      setAccessDenied(true);
      setLoading(false);
      return;
    }
    setMembershipRole(membership.role);
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
      const signingResults = await Promise.all(chunkArray(storagePaths, 250).map((pathBatch) =>
        supabase.storage.from("vehicle-media").createSignedUrls(pathBatch, 3600),
      ));
      for (const { data: signed, error: signingError } of signingResults) {
        if (signingError) setAppError(signingError.message);
        (signed || []).forEach((item) => {
          if (item.signedUrl) signedUrls.set(item.path, item.signedUrl);
        });
      }
    }

    const trelloUrls = [...new Set(rows.flatMap((row) => row.vehicle_media || [])
      .filter((item) => !item.storage_path && item.source_url?.startsWith("https://trello.com/"))
      .map((item) => item.source_url))];
    if (trelloUrls.length) {
      try {
        for (const urlBatch of chunkArray(trelloUrls, 250)) {
          const mediaResponse = await fetch("/api/trello-media", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              "x-supabase-publishable-key": supabasePublishableKey,
            },
            body: JSON.stringify({ urls: urlBatch }),
          });
          const mediaResult = await mediaResponse.json();
          if (!mediaResponse.ok) throw new Error(mediaResult.error || "Trello media could not be authorized.");
          Object.entries(mediaResult.urls || {}).forEach(([sourceUrl, proxyUrl]) => {
            signedUrls.set(sourceUrl, proxyUrl);
          });
        }
      } catch (mediaError) {
        setAppError(mediaError.message || "Trello photos are temporarily unavailable.");
      }
    }

    setCars(rows.map((row) => rowToCar(row, signedUrls)));
    setLoading(false);
  };

  useEffect(() => {
    if (session) loadCars();
    else {
      setCars([]);
      setMembershipRole(null);
      setLoading(false);
      setAccessDenied(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session || !membershipRole) return undefined;
    let refreshTimer;
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => loadCars(), 500);
    };
    const channel = supabase
      .channel("inventory-board-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicle_media" }, scheduleRefresh)
      .subscribe();
    return () => {
      clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [session, membershipRole]);

  useEffect(() => {
    setDisplayLimit(48);
  }, [tab, search, f.dealership, f.body, f.fuel, f.tier, f.flag]);

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
  const stockCounts = cars.reduce((counts, car) => {
    if (car.stock) counts.set(car.stock, (counts.get(car.stock) || 0) + 1);
    return counts;
  }, new Map());
  const qualityStatus = {
    missingStock: cars.filter((car) => !car.stock).length,
    missingDealership: cars.filter((car) => !car.dealership).length,
    missingKms: cars.filter((car) => !car.kms).length,
    missingPrice: cars.filter((car) => !car.price).length,
    missingCarfax: cars.filter((car) => !car.carfax).length,
    duplicateStocks: [...stockCounts.values()].filter((count) => count > 1).length,
  };

  const updateStatus = async (id, values) => {
    if (!canEdit) {
      setAppError("BDC accounts have view-only access.");
      return;
    }
    const currentCar = cars.find((car) => car.id === id);
    const { data: updated, error } = await supabase.from("inventory").update({
      ...values,
      updated_at: new Date().toISOString(),
      updated_by: session.user.id,
    }).eq("id", id).eq("version", currentCar?.version || 1).select("version, updated_at").maybeSingle();
    if (error) setAppError(error.message);
    else if (!updated) setAppError("This car was changed by another admin. Refresh and try again.");
    else {
      const uiValues = { ...values };
      if (Object.hasOwn(uiValues, "is_new")) {
        uiValues.isNew = uiValues.is_new;
        delete uiValues.is_new;
      }
      setCars((current) => current.map((car) => car.id === id
        ? { ...car, ...uiValues, version: updated.version, updatedAt: updated.updated_at }
        : car));
    }
  };

  const markSold = async (id) => {
    await updateStatus(id, { status: "sold", hot: false, is_new: false });
    setDetail(null);
  };
  const relist = async (id) => { await updateStatus(id, { status: "live" }); setDetail(null); };
  const remove = async (id) => {
    if (!canEdit) {
      setAppError("BDC accounts have view-only access.");
      return;
    }
    const car = cars.find((item) => item.id === id);
    if (!window.confirm(`Delete "${car?.title || "this vehicle"}"? This removes its stored media and cannot be undone.`)) return;
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

  const openAdd = () => {
    if (!canEdit) return;
    setForm({ ...emptyForm, uploadFiles: [] });
    setModalOpen(true);
  };
  const openEdit = (car) => {
    if (!canEdit) return;
    setForm({ ...car, uploadFiles: [] });
    setDetail(null);
    setModalOpen(true);
  };
  const saveCar = async () => {
    if (!canEdit) {
      setAppError("BDC accounts have view-only access.");
      return;
    }
    if (!form.title.trim()) return;
    setSaving(true);
    setUploadProgress(null);
    setAppError("");
    const id = form.id || crypto.randomUUID();
    const manualPhotos = form.manualPhotos || [];
    const uploadFiles = form.uploadFiles || [];
    const oversizedFile = uploadFiles.find((file) => file.size > MAX_UPLOAD_BYTES);
    if (oversizedFile) {
      setAppError(`${oversizedFile.name} is larger than the ${MAX_UPLOAD_MB} MB per-file upload limit.`);
      setSaving(false);
      return;
    }
    const record = {
      ...form,
      id,
      isNew: form.id ? form.isNew : true,
      photoCount: (form.storedMediaCount || 0) + manualPhotos.length + uploadFiles.length,
    };
    const row = carToRow(record, session.user.id);
    const saveQuery = form.id
      ? supabase.from("inventory").update(row).eq("id", id).eq("version", form.version || 1).select("id").maybeSingle()
      : supabase.from("inventory").insert(row).select("id").single();
    const { data: savedRow, error: saveError } = await saveQuery;
    if (saveError) {
      setAppError(saveError.message);
      setSaving(false);
      return;
    }
    if (!savedRow) {
      setAppError("This car was changed by another admin. Close the form, refresh, and try again.");
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
      try {
        if (file.size > RESUMABLE_UPLOAD_THRESHOLD) {
          await uploadResumableFile(file, storagePath, session, (fileProgress) => {
            setUploadProgress(Math.round(((index + fileProgress) / uploadFiles.length) * 100));
          });
        } else {
          const { error: uploadError } = await supabase.storage.from("vehicle-media")
            .upload(storagePath, file, { contentType: file.type || "image/jpeg", upsert: false });
          if (uploadError) throw uploadError;
          setUploadProgress(Math.round(((index + 1) / uploadFiles.length) * 100));
        }
      } catch (uploadError) {
        setAppError(uploadError.message || `Could not upload ${file.name}.`);
        setUploadProgress(null);
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
        await supabase.storage.from("vehicle-media").remove([storagePath]);
        setAppError(mediaRowError.message);
        setUploadProgress(null);
        setSaving(false);
        return;
      }
    }

    await loadCars();
    setUploadProgress(null);
    setSaving(false);
    setModalOpen(false);
  };
  const toggleIn = (key, val) =>
    setForm((fm) => ({
      ...fm,
      [key]: fm[key].includes(val) ? fm[key].filter((x) => x !== val) : [...fm[key], val],
    }));

  const loadTeam = async () => {
    if (!isOwner) return;
    setTeamLoading(true);
    setTeamError("");
    const { data, error } = await supabase
      .from("team_members")
      .select("email, role, active, created_at")
      .order("role")
      .order("email");
    if (error) setTeamError(error.message);
    else setTeamMembers(data || []);
    setTeamLoading(false);
  };

  const openTeam = async () => {
    if (!isOwner) return;
    setTeamOpen(true);
    await Promise.all([loadTeam(), loadMigrationStatus()]);
  };

  const addTeamMember = async () => {
    const email = teamEmail.trim().toLowerCase();
    if (!email) return;
    setTeamError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setTeamError("Enter a valid team email address.");
      return;
    }
    const { error } = await supabase.from("team_members").upsert(
      { email, role: "bdc", active: true },
      { onConflict: "email" },
    );
    if (error) setTeamError(error.message);
    else {
      setTeamEmail("");
      await loadTeam();
    }
  };

  const updateTeamMember = async (email, values) => {
    setTeamError("");
    const { error } = await supabase.from("team_members").update(values).eq("email", email);
    if (error) setTeamError(error.message);
    else await loadTeam();
  };

  const loadMigrationStatus = async () => {
    if (!isOwner) return;
    const [{ count: remaining }, { count: migrated }, { count: failed }] = await Promise.all([
      supabase.from("vehicle_media").select("id", { count: "exact", head: true }).is("storage_path", null),
      supabase.from("vehicle_media").select("id", { count: "exact", head: true }).not("storage_path", "is", null),
      supabase.from("vehicle_media").select("id", { count: "exact", head: true }).not("migration_error", "is", null),
    ]);
    setMigrationStatus({ remaining: remaining || 0, migrated: migrated || 0, failed: failed || 0 });
  };

  const startMediaMigration = async () => {
    if (!isOwner || migrationStarting) return;
    setMigrationStarting(true);
    setTeamError("");
    setTeamNotice("");
    try {
      const response = await fetch("/.netlify/functions/migrate-trello-media-background", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "x-supabase-publishable-key": supabasePublishableKey,
        },
      });
      if (!response.ok && response.status !== 202) throw new Error("The migration could not be started.");
      setTeamNotice("Permanent media migration started. You can close this panel; progress continues in the background.");
      setTimeout(loadMigrationStatus, 5000);
    } catch (error) {
      setTeamError(error.message || "The migration could not be started.");
    } finally {
      setMigrationStarting(false);
    }
  };

  if (!authReady) return <div className="min-h-screen bg-neutral-950 grid place-items-center text-sm text-neutral-500">Connecting securely…</div>;
  if (!session) return <AuthScreen />;
  if (passwordRecovery) return <PasswordUpdateScreen onDone={() => setPasswordRecovery(false)} />;
  if (accessDenied) return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 grid place-items-center p-5">
      <section className="max-w-md rounded-2xl border border-amber-500/30 bg-neutral-900 p-6 text-center">
        <h1 className="text-lg font-bold">Waiting for owner approval</h1>
        <p className="mt-2 text-sm text-neutral-400">Your account was created, but {session.user.email} cannot view inventory until the owner enables BDC access.</p>
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
              <p className="text-[11px] text-neutral-500 leading-none mt-1">
                {membershipRole === "bdc" ? "BDC inventory · view only" : membershipRole === "admin" ? "Admin inventory" : "Owner inventory"}
              </p>
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
          {canEdit && (
            <button onClick={openAdd}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold text-sm px-4 py-2 rounded-lg flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add car
            </button>
          )}
          {isOwner && (
            <button onClick={openTeam}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/20">
              <ShieldCheck className="h-4 w-4" /> Admin access
            </button>
          )}
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
              {visible.slice(0, displayLimit).map((car) => (
                <CarCard key={car.id} car={car} canEdit={canEdit}
                  onOpen={() => setDetail(car)} onSold={() => markSold(car.id)} />
              ))}
            </div>
            {visible.length > displayLimit && (
              <button onClick={() => setDisplayLimit((limit) => limit + 48)}
                className="mx-auto mt-6 block rounded-lg border border-neutral-700 bg-neutral-900 px-5 py-2 text-sm font-semibold text-neutral-300 hover:border-neutral-500">
                Load 48 more
              </button>
            )}
          </>
        )}
      </main>

      {detail && (
        <DetailPanel car={detail} canEdit={canEdit} onClose={() => setDetail(null)}
          onSold={() => markSold(detail.id)} onRelist={() => relist(detail.id)}
          onEdit={() => openEdit(detail)} onDelete={() => remove(detail.id)} />
      )}
      {modalOpen && canEdit && (
        <EditModal form={form} setForm={setForm} toggleIn={toggleIn} session={session}
          saving={saving} uploadProgress={uploadProgress} onSave={saveCar} onClose={() => setModalOpen(false)} />
      )}
      {teamOpen && isOwner && (
        <TeamPanel members={teamMembers} email={teamEmail} setEmail={setTeamEmail}
          loading={teamLoading} error={teamError} onAdd={addTeamMember}
          notice={teamNotice}
          onUpdate={updateTeamMember} onClose={() => setTeamOpen(false)}
          migrationStatus={migrationStatus} migrationStarting={migrationStarting}
          onStartMigration={startMediaMigration} onRefreshMigration={loadMigrationStatus}
          qualityStatus={qualityStatus} />
      )}
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}`}</style>
    </div>
  );
}

function TeamPanel({
  members, email, setEmail, loading, error, notice, onAdd, onUpdate, onClose,
  migrationStatus, migrationStarting, onStartMigration, onRefreshMigration, qualityStatus,
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="team-access-title"
        className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        <header className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div>
            <h2 id="team-access-title" className="flex items-center gap-2 font-bold"><Users className="h-4 w-4 text-amber-300" /> Team access</h2>
            <p className="mt-1 text-xs text-neutral-500">New people wait for your approval. Only you can change access.</p>
          </div>
          <button onClick={onClose} aria-label="Close team access" className="text-neutral-500 hover:text-white"><X className="h-5 w-5" /></button>
        </header>

        <div className="border-b border-neutral-800 p-5">
          <label htmlFor="team-email" className="text-xs font-medium text-neutral-400">Pre-add a BDC email (optional)</label>
          <div className="mt-1.5 flex gap-2">
            <input id="team-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") onAdd(); }}
              placeholder="rep@dealership.com" className="inp mt-0 flex-1" />
            <button onClick={onAdd} disabled={!email.trim()}
              className="rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-40">
              Add as BDC
            </button>
          </div>
          <p className="mt-2 text-[11px] text-neutral-500">New signups appear here as disabled BDC accounts. Enable only people you recognize.</p>
          {error && <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>}
          {notice && <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{notice}</p>}
        </div>

        <div className="border-b border-neutral-800 p-5">
          <p className="text-sm font-semibold text-neutral-200">Data cleanup queue</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-neutral-400 sm:grid-cols-3">
            <span>{qualityStatus.missingStock} missing stock #</span>
            <span>{qualityStatus.missingDealership} missing lot</span>
            <span>{qualityStatus.missingKms} missing KMs</span>
            <span>{qualityStatus.missingPrice} missing price</span>
            <span>{qualityStatus.missingCarfax} missing CARFAX</span>
            <span>{qualityStatus.duplicateStocks} duplicate stock group</span>
          </div>
          <p className="mt-2 text-[11px] text-neutral-500">These require real dealership data; the app will not invent missing values.</p>
        </div>

        <div className="border-b border-neutral-800 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-200">Permanent media storage</p>
              <p className="mt-1 text-xs text-neutral-500">
                {migrationStatus
                  ? `${migrationStatus.migrated} migrated · ${migrationStatus.remaining} remaining · ${migrationStatus.failed} need attention`
                  : "Checking migration status…"}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={onRefreshMigration}
                className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-300 hover:border-neutral-500">
                Refresh
              </button>
              <button onClick={onStartMigration} disabled={migrationStarting || !migrationStatus?.remaining}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40">
                {migrationStarting ? "Starting…" : "Migrate Trello media"}
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-3">
          {loading ? (
            <p className="py-10 text-center text-sm text-neutral-500">Loading team…</p>
          ) : members.map((member) => {
            const owner = member.role === "owner";
            return (
              <div key={member.email} className="flex flex-wrap items-center gap-3 rounded-xl px-3 py-3 hover:bg-neutral-800/60">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-200">{member.email}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">{owner ? "Protected owner account" : member.active ? "Access active" : "Pending or disabled"}</p>
                </div>
                {owner ? (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200">Owner</span>
                ) : (
                  <>
                    <div className="flex rounded-lg border border-neutral-700 bg-neutral-950 p-0.5">
                      {['bdc', 'admin'].map((role) => (
                        <button key={role} onClick={() => onUpdate(member.email, { role })}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${member.role === role ? "bg-neutral-100 text-neutral-950" : "text-neutral-500 hover:text-white"}`}>
                          {role.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => onUpdate(member.email, { active: !member.active })}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${member.active ? "border-neutral-700 text-neutral-400 hover:border-red-500/50 hover:text-red-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}>
                      {member.active ? "Disable" : "Approve"}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>
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

function VehicleImage({ src, alt, className }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className={`${className} flex flex-col items-center justify-center gap-1.5 text-center text-neutral-500`}>
        <ImageIcon className="h-6 w-6" />
        <span className="px-2 text-[10px] font-medium">Photo unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

function CarCard({ car, canEdit, onOpen, onSold }) {
  const sold = car.status === "sold";
  const tier = tierFor(car.price);
  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 hover:border-neutral-600 overflow-hidden transition-colors flex flex-col">
      <button onClick={onOpen} className="text-left flex-1">
        {car.photos?.[0] && (
          <VehicleImage src={car.photos[0]} alt="" className="w-full aspect-[4/3] object-cover bg-neutral-800" />
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
        ) : canEdit ? (
          <button onClick={onSold}
            className="w-full text-[11px] font-bold bg-neutral-800 hover:bg-red-600 text-neutral-400 hover:text-white py-1.5 rounded-md flex items-center justify-center gap-1 transition-colors">
            <Check className="w-3 h-3" /> Mark sold
          </button>
        ) : null}
      </div>
    </div>
  );
}

const Tag = ({ children }) => (
  <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-medium">{children}</span>
);

function DetailPanel({ car, canEdit, onClose, onSold, onRelist, onEdit, onDelete }) {
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
            {car.photoCount > 0 && <Tag>{car.photoCount} media files</Tag>}
          </div>
          {car.photos?.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              {car.photos.map((photo, index) => (
                <a key={photo} href={photo} target="_blank" rel="noreferrer" className="block">
                  <VehicleImage src={photo} alt={`${car.title} photo ${index + 1}`}
                    className="w-full aspect-[4/3] object-cover rounded-lg bg-neutral-800" />
                </a>
              ))}
            </div>
          )}
          {car.videos?.length > 0 && (
            <div className="mt-4 space-y-3">
              {car.videos.map((video, index) => (
                <video key={video} src={video} controls preload="metadata"
                  aria-label={`${car.title} video ${index + 1}`}
                  className="w-full rounded-lg bg-black" />
              ))}
            </div>
          )}
          {car.failedMediaCount > 0 && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {car.failedMediaCount} media file{car.failedMediaCount === 1 ? "" : "s"} need migration attention.
            </p>
          )}
          {car.carfax && car.carfax !== "on-file" ? (
            <a href={car.carfax} target="_blank" rel="noreferrer"
              className="mt-4 flex items-center gap-2 text-sm text-teal-400 bg-neutral-800/60 hover:bg-neutral-800 rounded-lg px-3 py-2">
              <FileText className="w-4 h-4" /> Open CARFAX report <ExternalLink className="w-3.5 h-3.5 ml-auto" />
            </a>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-sm text-amber-300 bg-neutral-800/60 rounded-lg px-3 py-2">
              <FileText className="w-4 h-4" /> CARFAX report not attached
            </p>
          )}
          {car.description && (
            <p className="text-sm text-neutral-300 whitespace-pre-wrap mt-4 leading-relaxed">{car.description}…</p>
          )}
          {canEdit && <div className="flex gap-2 mt-6 pb-4">
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
          </div>}
        </div>
      </div>
    </div>
  );
}

function EditModal({ form, setForm, toggleIn, session, saving, uploadProgress, onSave, onClose }) {
  const tier = tierFor(form.price);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [descriptionError, setDescriptionError] = useState("");
  const [descriptionNotice, setDescriptionNotice] = useState("");
  const [fileError, setFileError] = useState("");
  const [filePreviews, setFilePreviews] = useState([]);

  useEffect(() => {
    const previews = (form.uploadFiles || []).map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setFilePreviews(previews);
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [form.uploadFiles]);

  const removeUpload = (removeIndex) => {
    setForm((current) => ({
      ...current,
      uploadFiles: (current.uploadFiles || []).filter((_, index) => index !== removeIndex),
    }));
  };

  const generateDescription = async () => {
    if (!form.title.trim() || generatingDescription) return;
    setGeneratingDescription(true);
    setDescriptionError("");
    setDescriptionNotice("");
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
      if (Number.isInteger(result.remainingToday)) {
        setDescriptionNotice(`AI description generated. ${result.remainingToday} of 10 left today.`);
      }
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
            {descriptionNotice && <p className="mt-1.5 text-xs text-emerald-300">{descriptionNotice}</p>}
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
            <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">Use permanent public image URLs only. Uploaded files are stored privately in Supabase.</p>
          </F>
          <F label="Upload photos or videos">
            <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-700 bg-neutral-800/50 px-3 py-4 text-sm text-neutral-400 hover:border-neutral-500 hover:text-white">
              <Upload className="h-4 w-4" />
              {form.uploadFiles?.length ? "Add more photos or videos" : "Choose files from this device"}
              <input className="hidden" type="file" accept="image/*,video/mp4,video/quicktime" multiple
                onChange={(event) => {
                  const selectedFiles = Array.from(event.target.files || []);
                  const oversizedFiles = selectedFiles.filter((file) => file.size > MAX_UPLOAD_BYTES);
                  const validFiles = selectedFiles.filter((file) => file.size <= MAX_UPLOAD_BYTES);
                  setFileError(oversizedFiles.length ? `${oversizedFiles.map((file) => file.name).join(", ")} exceeded ${MAX_UPLOAD_MB} MB and was not selected.` : "");
                  setForm((current) => {
                    const existingFiles = current.uploadFiles || [];
                    const existingKeys = new Set(existingFiles.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
                    const newFiles = validFiles.filter((file) => !existingKeys.has(`${file.name}:${file.size}:${file.lastModified}`));
                    return { ...current, uploadFiles: [...existingFiles, ...newFiles] };
                  });
                  event.target.value = "";
                }} />
            </label>
            {filePreviews.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {filePreviews.map(({ file, url }, index) => (
                  <div key={`${file.name}:${file.size}:${file.lastModified}`} className="group relative overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950">
                    {file.type.startsWith("video/") ? (
                      <video src={url} controls preload="metadata" className="aspect-[4/3] w-full bg-black object-cover" />
                    ) : (
                      <img src={url} alt={`Selected upload: ${file.name}`} className="aspect-[4/3] w-full object-cover" />
                    )}
                    <button type="button" onClick={() => removeUpload(index)} aria-label={`Remove ${file.name}`}
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/75 p-1 text-white shadow hover:bg-red-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-6">
                      <p className="truncate text-[10px] font-medium text-white">{file.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">No fixed file-count limit. Supabase Free allows up to {MAX_UPLOAD_MB} MB per file; large files use resumable chunks.</p>
            {fileError && <p className="mt-1.5 text-xs text-red-300">{fileError}</p>}
          </F>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-neutral-800">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-sm font-medium">Cancel</button>
          <button onClick={onSave} disabled={saving || !form.title.trim()}
            className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-bold">
            {uploadProgress !== null ? `Uploading ${uploadProgress}%` : saving ? "Saving…" : form.id ? "Save changes" : "Add to board"}
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
