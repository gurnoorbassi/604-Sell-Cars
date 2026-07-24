import React, { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, ExternalLink, Gauge, MapPin, ShieldCheck, X } from "lucide-react";
import BookingForm from "../components/BookingForm";
import SiteHeader from "../components/SiteHeader";
import {
  api, carImages, carName, carVideos, cleanVehicleDescription,
  mileageLabel, priceLabel, vehicleMileage,
} from "../lib/api";
import { LANDING_URL, WEBSITE_URL } from "../lib/links";

export default function CarDetailPage({ id }) {
  const [car, setCar] = useState(null);
  const [active, setActive] = useState(0);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/api/cars/${encodeURIComponent(id)}`).then((row) => {
      setCar(row);
      const name = carName(row);
      const mileage = vehicleMileage(row);
      document.title = `${name} for Sale | 604 Sell Cars`;
      const description = document.querySelector('meta[name="description"]') || document.head.appendChild(document.createElement("meta"));
      description.name = "description";
      description.content = `${name}, ${mileageLabel(row)}, available at ${row.lot_name}. Book a viewing online.`;
      const schema = document.createElement("script");
      schema.type = "application/ld+json";
      schema.text = JSON.stringify({
        "@context": "https://schema.org", "@type": "Vehicle", name,
        vehicleModelDate: row.year, manufacturer: row.make, model: row.model,
        mileageFromOdometer: mileage ? { "@type": "QuantitativeValue", value: mileage.value, unitCode: "KMT" } : undefined,
        offers: { "@type": "Offer", price: row.price_amount, priceCurrency: "CAD", availability: "https://schema.org/InStock" },
      });
      schema.dataset.vehicleSchema = id;
      document.querySelectorAll('script[data-vehicle-schema]').forEach((item) => item.remove());
      document.head.appendChild(schema);
    }).catch((requestError) => setError(requestError.message));
  }, [id]);

  if (error) return <StatePage title="Vehicle unavailable" text={error} />;
  if (!car) return <StatePage title="Loading vehicle" text="Checking live inventory and media…" />;

  const images = carImages(car);
  const videos = carVideos(car);
  const description = cleanVehicleDescription(car);
  const previous = () => setActive((index) => (index - 1 + images.length) % images.length);
  const next = () => setActive((index) => (index + 1) % images.length);

  return (
    <div className="min-h-screen bg-[#f5f4f1] text-neutral-950">
      <SiteHeader />
      <main className="mx-auto w-[min(1240px,92vw)] py-7 sm:py-10">
        <a href={`${WEBSITE_URL}/inventory`} className="inline-flex items-center gap-2 text-sm font-bold text-neutral-600 transition hover:text-neutral-950">
          <ArrowLeft size={16} /> Back to inventory
        </a>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,.85fr)] lg:items-start">
          <section>
            <div className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-neutral-200 shadow-[0_20px_60px_rgba(20,20,20,.12)]">
              {images[active] ? (
                <img src={images[active]} alt={`${carName(car)} photo ${active + 1}`} className="h-full w-full object-cover" />
              ) : <div className="grid h-full place-items-center font-semibold text-neutral-500">Photos coming soon</div>}
              {images.length > 1 && (
                <>
                  <button onClick={previous} aria-label="Previous photo" className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-lg backdrop-blur transition hover:bg-white">
                    <ChevronLeft />
                  </button>
                  <button onClick={next} aria-label="Next photo" className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-lg backdrop-blur transition hover:bg-white">
                    <ChevronRight />
                  </button>
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-white">{active + 1} / {images.length}</span>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                {images.map((image, index) => (
                  <button key={`${image}-${index}`} onClick={() => setActive(index)} aria-label={`View photo ${index + 1}`}
                    className={`h-20 w-24 shrink-0 overflow-hidden rounded-md border-2 transition ${active === index ? "border-red-600" : "border-transparent opacity-75 hover:opacity-100"}`}>
                    <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {videos.map((video) => <video key={video} controls preload="metadata" className="mt-5 w-full rounded-xl bg-black"><source src={video} /></video>)}
          </section>

          <aside className="rounded-xl border border-neutral-200 bg-white p-6 shadow-[0_14px_45px_rgba(20,20,20,.08)] sm:p-7 lg:sticky lg:top-32">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-red-600"><MapPin size={13} />{car.lot_name}</p>
            <h1 className="mt-3 text-3xl font-black leading-[1.02] tracking-[-.045em] sm:text-4xl">{carName(car)}</h1>
            <p className="mt-5 text-3xl font-black tracking-tight">{priceLabel(car)}</p>
            <p className="mt-2 text-xs text-neutral-500">Plus applicable taxes and licensing.</p>

            <dl className="mt-7 grid grid-cols-2 overflow-hidden rounded-lg border border-neutral-200">
              <Spec icon={Gauge} term="Mileage" value={mileageLabel(car)} />
              <Spec term="Body style" value={car.body_type} />
              <Spec term="Fuel" value={car.fuel_type || car.fuel_tags?.join(", ")} />
              <Spec term="Stock" value={car.stock} />
              <Spec term="Year" value={car.year} />
              <Spec term="Trim" value={car.trim} />
            </dl>

            <div className="mt-5 rounded-lg bg-neutral-950 p-4 text-white">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-red-400"><MapPin size={14} /> Viewing location</p>
              <strong className="mt-2 block">{car.lot_name}</strong>
              <span className="mt-1 block text-sm leading-6 text-neutral-300">{car.lot_address}</span>
            </div>

            <a href={`${LANDING_URL}?car=${encodeURIComponent(car.id)}`} className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-red-600 p-4 font-black text-white transition hover:bg-red-700">
              <CalendarDays size={18} /> Book a viewing
            </a>
            {car.carfax_url && (
              <a href={car.carfax_url} target="_blank" rel="noreferrer" className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-neutral-300 p-3 font-bold transition hover:bg-neutral-50">
                View CARFAX <ExternalLink size={15} />
              </a>
            )}
            <div className="mt-5 flex items-center gap-3 border-t border-neutral-100 pt-5 text-sm text-neutral-600">
              <ShieldCheck size={20} className="text-green-600" />
              <span><strong className="block text-neutral-900">Live availability</strong>Book directly from current inventory.</span>
            </div>
          </aside>
        </div>

        {description && (
          <section className="mt-10 max-w-4xl rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-black uppercase tracking-[.18em] text-red-600">Vehicle overview</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">About this {car.year} {car.make || "vehicle"}</h2>
            <p className="mt-6 whitespace-pre-line text-[15px] leading-7 text-neutral-700">{description}</p>
            <div className="mt-7 flex flex-wrap gap-4 border-t border-neutral-100 pt-6 text-sm font-semibold text-neutral-600">
              <span className="flex items-center gap-2"><Check size={16} className="text-green-600" /> Trades considered</span>
              <span className="flex items-center gap-2"><Check size={16} className="text-green-600" /> Financing available</span>
              <span className="flex items-center gap-2"><Check size={16} className="text-green-600" /> Book online</span>
            </div>
          </section>
        )}
      </main>

      {booking && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-3 backdrop-blur-sm sm:p-8">
          <div className="mx-auto max-w-3xl">
            <button onClick={() => setBooking(false)} className="mb-2 ml-auto flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold shadow">
              <X size={16} /> Close
            </button>
            <BookingForm initialCarId={car.id} compact />
          </div>
        </div>
      )}
    </div>
  );
}

function Spec({ icon: Icon, term, value }) {
  return (
    <div className="border-b border-r border-neutral-200 p-4">
      <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-neutral-500">{Icon && <Icon size={13} />}{term}</dt>
      <dd className="mt-1.5 text-sm font-black">{value || "Not listed"}</dd>
    </div>
  );
}

function StatePage({ title, text }) {
  return (
    <div className="min-h-screen bg-[#f5f4f1]"><SiteHeader /><main className="mx-auto w-[min(1240px,92vw)] py-24 text-center"><h1 className="text-3xl font-black">{title}</h1><p className="mt-3 text-neutral-500">{text}</p><a href={`${WEBSITE_URL}/inventory`} className="mt-6 inline-flex rounded-md bg-neutral-950 px-5 py-3 font-bold text-white">Browse inventory</a></main></div>
  );
}
