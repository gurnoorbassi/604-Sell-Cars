import React, { useEffect, useState } from "react";
import BookingForm from "../components/BookingForm";
import SiteHeader from "../components/SiteHeader";
import { api, carImages, carName, carVideos } from "../lib/api";

export default function CarDetailPage({ id }) {
  const [car, setCar] = useState(null);
  const [active, setActive] = useState(0);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api(`/api/cars/${encodeURIComponent(id)}`).then((row) => {
      setCar(row);
      const name = carName(row);
      document.title = `${name} for Sale | 604 Sell Cars`;
      const description = document.querySelector('meta[name="description"]') || document.head.appendChild(document.createElement("meta"));
      description.name = "description";
      description.content = `${name}, ${Number(row.mileage || 0).toLocaleString()} km, available at ${row.lot_name}. Book a viewing online.`;
      const schema = document.createElement("script");
      schema.type = "application/ld+json";
      schema.text = JSON.stringify({
        "@context": "https://schema.org", "@type": "Vehicle", name,
        vehicleModelDate: row.year, manufacturer: row.make, model: row.model,
        mileageFromOdometer: { "@type": "QuantitativeValue", value: row.mileage, unitCode: "KMT" },
        offers: { "@type": "Offer", price: row.price_amount, priceCurrency: "CAD", availability: "https://schema.org/InStock" },
      });
      document.head.appendChild(schema);
    }).catch((requestError) => setError(requestError.message));
  }, [id]);
  if (error) return <p className="p-10">{error}</p>;
  if (!car) return <p className="p-10">Loading vehicle…</p>;
  const images = carImages(car);
  const videos = carVideos(car);
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950">
      <SiteHeader />
      <main className="mx-auto w-[min(1180px,92vw)] py-8">
        <a href="/site/inventory" className="text-sm font-bold text-neutral-500">← Back to inventory</a>
        <div className="mt-5 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <section>
            <div className="aspect-[4/3] overflow-hidden bg-neutral-200">
              {images[active] ? <img src={images[active]} alt={`${carName(car)} photo ${active + 1}`} className="h-full w-full object-cover" />
                : <div className="grid h-full place-items-center text-neutral-500">Photos coming soon</div>}
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-8">
              {images.map((image, index) => (
                <button key={`${image}-${index}`} onClick={() => setActive(index)} className={`aspect-square overflow-hidden border-2 ${active === index ? "border-red-600" : "border-transparent"}`}>
                  <img src={image.startsWith("/uploads/") ? image.replace("/images/", "/thumbs/") : image}
                    alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            {videos.map((video) => <video key={video} controls preload="metadata" className="mt-5 w-full bg-black"><source src={video} /></video>)}
          </section>
          <aside>
            <p className="text-xs font-black uppercase tracking-[.2em] text-red-600">{car.lot_name}</p>
            <h1 className="mt-2 text-4xl font-black leading-none tracking-tight">{carName(car)}</h1>
            <p className="mt-5 text-3xl font-black">${Number(car.price_amount || 0).toLocaleString()}</p>
            <dl className="mt-7 grid grid-cols-2 gap-px bg-neutral-200 border border-neutral-200">
              {[["Mileage", `${Number(car.mileage || 0).toLocaleString()} km`], ["Body", car.body_type],
                ["Fuel", car.fuel_type || car.fuel_tags?.join(", ")], ["Stock", car.stock],
                ["Year", car.year], ["Trim", car.trim]].map(([term, value]) => (
                <div key={term} className="bg-white p-3"><dt className="text-xs uppercase text-neutral-500">{term}</dt><dd className="font-bold">{value || "—"}</dd></div>
              ))}
            </dl>
            <div className="mt-6 border-l-4 border-red-600 bg-white p-4">
              <strong className="block">{car.lot_name}</strong><span>{car.lot_address}</span>
            </div>
            <button onClick={() => setBooking(true)} className="mt-5 w-full bg-red-600 p-4 font-black uppercase text-white">Book a viewing</button>
            {car.carfax_url && <a href={car.carfax_url} target="_blank" rel="noreferrer" className="mt-3 block w-full border border-neutral-300 p-3 text-center font-bold">View CARFAX ↗</a>}
          </aside>
        </div>
        {car.description && <section className="mt-12 max-w-3xl"><h2 className="text-2xl font-black">Vehicle description</h2><p className="mt-4 whitespace-pre-line text-neutral-700">{car.description}</p></section>}
      </main>
      {booking && <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-4 sm:p-10"><div className="mx-auto max-w-3xl"><button onClick={() => setBooking(false)} className="mb-2 w-full bg-neutral-900 p-3 text-right text-white">Close ×</button><BookingForm initialCarId={car.id} compact /></div></div>}
    </div>
  );
}
