import React, { useEffect, useMemo, useState } from "react";
import CarCard from "../components/CarCard";
import SiteHeader from "../components/SiteHeader";
import { api, carImages, carName } from "../lib/api";

const params = () => new URLSearchParams(window.location.search);

export default function PublicSite() {
  const inventoryPage = window.location.pathname.includes("/inventory");
  const [cars, setCars] = useState([]);
  const [filters, setFilters] = useState({ lots: [], body_types: [], fuel_types: [], makes: [], years: [] });
  const [loading, setLoading] = useState(true);
  const current = useMemo(params, []);

  useEffect(() => {
    document.title = inventoryPage ? "Used Cars for Sale | 604 Sell Cars" : "604 Sell Cars | Find Your Next Vehicle";
    Promise.all([
      api(`/api/cars?${current.toString()}`),
      api("/api/filters"),
    ]).then(([rows, options]) => {
      setCars(rows);
      setFilters(options);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [current, inventoryPage]);

  function update(name, value) {
    const next = params();
    if (value) next.set(name, value);
    else next.delete(name);
    window.location.href = `${window.location.pathname}?${next.toString()}`;
  }

  const featured = cars.find((car) => car.featured) || cars[0];
  const heroImage = featured ? carImages(featured)[0] : "";
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950">
      <SiteHeader />
      {!inventoryPage && (
        <section className="relative isolate min-h-[620px] overflow-hidden bg-neutral-950 text-white">
          {heroImage && <img src={heroImage} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-55" />}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black via-black/80 to-black/10" />
          <div className="mx-auto flex min-h-[620px] w-[min(1180px,92vw)] items-end pb-16">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[.24em] text-red-500">Featured inventory</p>
              <h1 className="mt-4 text-5xl font-black leading-none tracking-[-.055em] sm:text-7xl">{featured ? carName(featured) : "Find your next vehicle."}</h1>
              {featured && <p className="mt-5 text-2xl font-black">${Number(featured.price_amount || 0).toLocaleString()}</p>}
              <div className="mt-7 flex flex-wrap gap-3">
                {featured && <a className="bg-red-600 px-5 py-3 font-black" href={`/site/cars/${featured.id}`}>View vehicle</a>}
                <a className="border border-white/40 px-5 py-3 font-bold" href="/site/inventory">Browse all inventory</a>
              </div>
            </div>
          </div>
        </section>
      )}
      <main className="mx-auto w-[min(1180px,92vw)] py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-red-600">Available now</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight">{inventoryPage ? "Search inventory" : "Latest vehicles"}</h2>
          </div>
          <a href="/landing" className="font-bold text-red-600">Book a viewing →</a>
        </div>
        {inventoryPage && (
          <div className="mt-8 grid gap-3 border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
            <input defaultValue={current.get("search") || ""} onKeyDown={(event) => {
              if (event.key === "Enter") update("search", event.currentTarget.value);
            }} placeholder="Search make, model, stock" className="border border-neutral-300 p-3" />
            <Filter label="All lots" name="lot" values={filters.lots} current={current} update={update} />
            <Filter label="All makes" name="make" values={filters.makes} current={current} update={update} />
            <Filter label="All body types" name="bodyType" values={filters.body_types} current={current} update={update} />
            <Filter label="All fuel types" name="fuel" values={filters.fuel_types} current={current} update={update} />
            <Filter label="All years" name="year" values={filters.years} current={current} update={update} />
            <input type="number" defaultValue={current.get("maxPrice") || ""} onBlur={(event) => update("maxPrice", event.currentTarget.value)}
              placeholder="Maximum price" className="border border-neutral-300 p-3" />
            <select value={current.get("sort") || "newest"} onChange={(event) => update("sort", event.target.value)} className="border border-neutral-300 p-3">
              <option value="newest">Newest</option><option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option><option value="mileage">Lowest mileage</option>
            </select>
          </div>
        )}
        {loading ? <p className="py-20 text-neutral-500">Loading available inventory…</p> : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cars.slice(0, inventoryPage ? 500 : 9).map((car) => <CarCard key={car.id} car={car} />)}
          </div>
        )}
        {!loading && !cars.length && <p className="mt-8 border border-neutral-200 bg-white p-8 text-neutral-500">No available vehicles match these filters.</p>}
      </main>
    </div>
  );
}

function Filter({ label, name, values = [], current, update }) {
  return (
    <select value={current.get(name) || ""} onChange={(event) => update(name, event.target.value)} className="border border-neutral-300 p-3">
      <option value="">{label}</option>
      {values.filter(Boolean).map((value) => <option key={value} value={value}>{value}</option>)}
    </select>
  );
}
