import React, { useEffect, useState } from "react";
import {
  ArrowLeft, CalendarDays, Camera, Check, ChevronLeft, ChevronRight,
  ExternalLink, Gauge, MapPin, Maximize2, ShieldCheck, X,
} from "lucide-react";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import VehicleImage from "../components/VehicleImage";
import {
  api, carImages, carName, carVideos, cleanVehicleDescription,
  mileageLabel, priceLabel, vehicleMileage,
} from "../lib/api";
import { LANDING_URL, WEBSITE_URL } from "../lib/links";

export default function CarDetailPage({ id }) {
  const [car, setCar] = useState(null);
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/api/cars/${encodeURIComponent(id)}`).then((row) => {
      setCar(row);
      const name = carName(row);
      const mileage = vehicleMileage(row);
      document.title = `${name} for Sale | 604 Sell Cars`;
      const meta = document.querySelector('meta[name="description"]') || document.head.appendChild(document.createElement("meta"));
      meta.name = "description";
      meta.content = `${name}, ${mileageLabel(row)}, available ${row.location_label}. Ask our team to confirm a viewing.`;
      const schema = document.createElement("script");
      schema.type = "application/ld+json";
      schema.text = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Vehicle",
        name,
        vehicleModelDate: row.year,
        manufacturer: row.make,
        model: row.model,
        mileageFromOdometer: mileage ? { "@type": "QuantitativeValue", value: mileage.value, unitCode: "KMT" } : undefined,
        offers: { "@type": "Offer", price: row.price_amount, priceCurrency: "CAD", availability: "https://schema.org/InStock" },
      });
      schema.dataset.vehicleSchema = id;
      document.querySelectorAll("script[data-vehicle-schema]").forEach((item) => item.remove());
      document.head.appendChild(schema);
    }).catch((requestError) => setError(requestError.message));
  }, [id]);

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setLightboxOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [lightboxOpen]);

  if (error) return <StatePage title="Vehicle unavailable" text={error} />;
  if (!car) return <StatePage title="Loading vehicle" text="Checking live inventory and media…" />;

  const images = carImages(car);
  const videos = carVideos(car);
  const description = cleanVehicleDescription(car);
  const previous = () => setActive((index) => (index - 1 + images.length) % images.length);
  const next = () => setActive((index) => (index + 1) % images.length);

  return (
    <div className="min-h-screen bg-[#090a0c] text-white">
      <SiteHeader />

      <main className="overflow-x-hidden pb-20 lg:pb-0">
        <section className="border-b border-white/10 bg-[#0d0f12]">
          <div className="mx-auto w-[min(1380px,94vw)] py-6 sm:py-8">
            <a href={`${WEBSITE_URL}/inventory`} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.13em] text-neutral-500 hover:text-white">
              <ArrowLeft size={14} /> Back to inventory
            </a>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.17em] text-[#d92d22]">
                  <MapPin size={13} /> 604SELLSCARS · {car.location_label}
                </p>
                <h1 className="mt-2 text-[clamp(2.25rem,4.5vw,4.35rem)] font-black leading-[.98] tracking-[-.06em]">{carName(car)}</h1>
              </div>
              <div className="sm:text-right">
                <small className="block text-[9px] font-black uppercase tracking-[.16em] text-neutral-400">Vehicle price</small>
                <strong className="mt-1 block text-3xl font-black tracking-[-.04em] sm:text-4xl">{priceLabel(car)}</strong>
                <span className="mt-1 block text-xs text-neutral-500">Plus applicable taxes and licensing</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto grid min-w-0 w-[min(1380px,94vw)] gap-8 py-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,.65fr)] lg:items-start">
          <section className="min-w-0">
            <div className="relative aspect-[16/10] overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_center,#1a1d22_0%,#08090b_75%)] shadow-[0_24px_70px_rgba(0,0,0,.42)]">
              {images[active] ? (
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="absolute inset-0 block h-full w-full cursor-zoom-in overflow-hidden"
                  aria-label={`Enlarge photo ${active + 1}`}
                >
                  <VehicleImage sources={[images[active]]} alt={`${carName(car)} photo ${active + 1}`} loading="eager" fetchPriority="high"
                    className="absolute inset-0 h-full w-full object-contain" />
                  <span className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/75 px-3 py-2 text-[10px] font-black uppercase tracking-[.12em] text-white backdrop-blur">
                    <Maximize2 size={14} /> Enlarge
                  </span>
                </button>
              ) : (
                <div className="grid h-full place-items-center text-sm font-semibold text-neutral-500">Photos coming soon</div>
              )}
              {images.length > 1 && (
                <>
                  <button onClick={previous} aria-label="Previous photo" className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center bg-black/70 text-white backdrop-blur transition hover:bg-black">
                    <ChevronLeft />
                  </button>
                  <button onClick={next} aria-label="Next photo" className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center bg-black/70 text-white backdrop-blur transition hover:bg-black">
                    <ChevronRight />
                  </button>
                  <span className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/75 px-3 py-2 text-xs font-bold text-white backdrop-blur">
                    <Camera size={14} /> {active + 1} / {images.length}
                  </span>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="mobile-gallery-strip mt-3 flex w-full max-w-full gap-2 overflow-x-auto pb-2">
                {images.map((image, index) => (
                  <button key={`${image}-${index}`} onClick={() => setActive(index)} aria-label={`View photo ${index + 1}`}
                    className={`aspect-[4/3] w-24 shrink-0 overflow-hidden border-2 bg-[#0c0e11] transition sm:w-28 ${active === index ? "border-[#ef3f32]" : "border-transparent opacity-70 hover:opacity-100"}`}>
                    <VehicleImage sources={[image]} alt={`${carName(car)} thumbnail ${index + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {videos.map((video) => (
              <video key={video} controls preload="metadata" className="mt-6 w-full bg-black"><source src={video} /></video>
            ))}

            <section className="mt-10 border border-white/10 bg-[#121417]">
              <div className="border-b border-white/10 p-6 sm:p-8">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#d92d22]">Vehicle overview</p>
                <h2 className="mt-2 text-3xl font-black tracking-[-.045em]">About this {car.year || ""} {car.make || "vehicle"}</h2>
              </div>
              <div className="p-6 sm:p-8">
                {description ? (
                  <p className="whitespace-pre-line text-[15px] leading-7 text-neutral-300">{description}</p>
                ) : (
                  <p className="text-[15px] leading-7 text-neutral-400">Request a viewing and our team will confirm the vehicle details before you make the drive.</p>
                )}
                <div className="mt-8 grid gap-3 border-t border-white/10 pt-6 text-sm font-semibold text-neutral-300 sm:grid-cols-2">
                  <span className="flex items-center gap-2"><Check size={16} className="text-green-600" /> Live inventory status</span>
                  <span className="flex items-center gap-2"><Check size={16} className="text-green-600" /> Team-confirmed handoff</span>
                </div>
              </div>
            </section>
          </section>

          <aside className="border border-white/10 bg-[#121417] lg:sticky lg:top-[112px]">
            <dl className="grid grid-cols-2 border-b border-white/10">
              <Spec icon={Gauge} term="Mileage" value={mileageLabel(car)} />
              <Spec term="Body style" value={car.body_type} />
              <Spec term="Fuel" value={car.fuel_type || car.fuel_tags?.join(", ")} />
              <Spec term="Stock" value={car.stock} />
              <Spec term="Year" value={car.year} />
              <Spec term="Trim" value={car.trim} />
            </dl>

            <div className="p-5 sm:p-6">
              <div className="bg-[#111216] p-5 text-white">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.15em] text-[#ff6b60]">
                  <MapPin size={14} /> Viewing location
                </p>
                <strong className="mt-3 block text-lg">{car.location_label}</strong>
                <span className="mt-1 block text-sm leading-6 text-neutral-300">Approximate area only. Our team shares the handoff details after confirming availability.</span>
              </div>

              <a href={`${LANDING_URL}?car=${encodeURIComponent(car.id)}`} className="mt-4 flex w-full items-center justify-center gap-2 bg-[#ef3f32] p-4 text-sm font-black text-white transition hover:bg-[#d92d22]">
                <CalendarDays size={18} /> Book this vehicle
              </a>
              {car.carfax_url && (
                <a href={car.carfax_url} target="_blank" rel="noreferrer" className="mt-3 flex w-full items-center justify-center gap-2 border border-white/15 p-3 text-sm font-bold transition hover:bg-white/5">
                  View CARFAX <ExternalLink size={15} />
                </a>
              )}
              <div className="mt-5 flex items-start gap-3 border-t border-white/10 pt-5 text-sm text-neutral-400">
                <ShieldCheck size={20} className="mt-0.5 shrink-0 text-green-600" />
                <span><strong className="block text-white">Current availability</strong>This vehicle is listed as available. Our team verifies it before confirming your viewing.</span>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#090a0c]/95 p-3 backdrop-blur lg:hidden">
        <a
          href={`${LANDING_URL}?car=${encodeURIComponent(car.id)}`}
          className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 bg-[#ef3f32] px-5 py-3.5 text-sm font-black text-white"
        >
          <CalendarDays size={17} /> Book a viewing
        </a>
      </div>

      {lightboxOpen && images[active] && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label={`${carName(car)} photo viewer`}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-xs font-bold text-neutral-300">
              Photo {active + 1} of {images.length} <span className="ml-2 text-neutral-500">Pinch to zoom</span>
            </p>
            <button type="button" onClick={() => setLightboxOpen(false)} className="grid h-11 w-11 place-items-center border border-white/15 bg-white/5" aria-label="Close photo viewer">
              <X />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-2 sm:p-6">
            <img
              src={images[active]}
              alt={`${carName(car)} enlarged photo ${active + 1}`}
              className="lightbox-image block max-h-full max-w-full object-contain"
            />
            {images.length > 1 && (
              <>
                <button type="button" onClick={previous} aria-label="Previous enlarged photo" className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center bg-black/70 text-white backdrop-blur">
                  <ChevronLeft />
                </button>
                <button type="button" onClick={next} aria-label="Next enlarged photo" className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center bg-black/70 text-white backdrop-blur">
                  <ChevronRight />
                </button>
              </>
            )}
          </div>
          <a href={images[active]} target="_blank" rel="noreferrer" className="border-t border-white/10 px-4 py-3 text-center text-xs font-black uppercase tracking-[.12em] text-white">
            Open original image
          </a>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}

function Spec({ icon: Icon, term, value }) {
  return (
    <div className="border-b border-r border-white/10 p-4">
      <dt className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.13em] text-neutral-400">
        {Icon && <Icon size={13} />}{term}
      </dt>
      <dd className="mt-2 text-sm font-black">{value || "Not listed"}</dd>
    </div>
  );
}

function StatePage({ title, text }) {
  return (
    <div className="min-h-screen bg-[#090a0c] text-white">
      <SiteHeader />
      <main className="mx-auto w-[min(1380px,94vw)] py-24 text-center">
        <h1 className="text-3xl font-black">{title}</h1>
        <p className="mt-3 text-neutral-500">{text}</p>
        <a href={`${WEBSITE_URL}/inventory`} className="mt-6 inline-flex bg-[#ef3f32] px-5 py-3 text-sm font-bold text-white">Browse inventory</a>
      </main>
      <SiteFooter />
    </div>
  );
}
