import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarCheck, Clock3, MapPinned, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import CarCard from "../components/CarCard";
import SiteHeader from "../components/SiteHeader";
import { api, carImages, carName, mileageLabel, priceLabel } from "../lib/api";
import { LANDING_URL, WEBSITE_URL } from "../lib/links";

const params = () => new URLSearchParams(window.location.search);

export default function PublicSite() {
  const inventoryPage = window.location.pathname.includes("/inventory");
  const [cars, setCars] = useState([]);
  const [filters, setFilters] = useState({ lots: [], body_types: [], fuel_types: [], makes: [], years: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const current = useMemo(params, []);

  useEffect(() => {
    document.title = inventoryPage ? "Browse Inventory | 604 Sell Cars" : "604 Sell Cars | Metro Vancouver Vehicle Marketplace";
    Promise.all([api(`/api/cars?${current.toString()}`), api("/api/filters")])
      .then(([rows, options]) => {
        setCars(rows);
        setFilters(options);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [current, inventoryPage]);

  function update(name, value) {
    const next = params();
    if (value) next.set(name, value);
    else next.delete(name);
    window.location.href = `${window.location.pathname}${next.toString() ? `?${next}` : ""}`;
  }

  function clearFilters() {
    window.location.href = window.location.pathname;
  }

  const featured = cars.find((car) => car.featured) || cars[0];
  const heroImage = featured ? carImages(featured)[0] : "";
  const hasFilters = [...current.keys()].length > 0;

  return (
    <div className="min-h-screen bg-[#f5f4f1] text-neutral-950">
      <SiteHeader />

      {!inventoryPage && (
        <>
          <section className="relative isolate min-h-[650px] overflow-hidden bg-neutral-950 text-white">
            {heroImage && <img src={heroImage} alt="" className="absolute inset-0 -z-30 h-full w-full object-cover" />}
            <div className="absolute inset-0 -z-20 bg-gradient-to-r from-black via-black/80 to-black/15" />
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] bg-[size:90px_90px] opacity-30" />
            <div className="mx-auto flex min-h-[650px] w-[min(1240px,92vw)] items-end pb-14 pt-24 sm:pb-20">
              <div className="max-w-[760px]">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.22em] text-red-400">
                  <span className="h-px w-8 bg-red-500" /> Live Metro Vancouver inventory
                </p>
                <h1 className="mt-6 text-[clamp(3rem,7vw,6.3rem)] font-black leading-[.88] tracking-[-.065em]">
                  Find the right car.<br /><span className="text-white/55">Book it on your time.</span>
                </h1>
                <p className="mt-7 max-w-xl text-base leading-7 text-neutral-300 sm:text-lg">
                  Shop available vehicles from trusted local dealerships and reserve a viewing online—no back-and-forth required.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a href={`${WEBSITE_URL}/inventory`} className="inline-flex items-center gap-2 rounded-md bg-red-600 px-6 py-4 font-black text-white transition hover:bg-red-700">
                    Browse inventory <ArrowRight size={18} />
                  </a>
                  <a href={LANDING_URL} className="rounded-md border border-white/30 bg-white/10 px-6 py-4 font-bold backdrop-blur transition hover:bg-white/20">Book a viewing</a>
                </div>
              </div>
              {featured && (
                <a href={`/cars/${featured.id}`} className="absolute bottom-8 right-[4vw] hidden w-72 rounded-xl border border-white/20 bg-black/55 p-4 backdrop-blur-xl lg:block">
                  <small className="font-bold uppercase tracking-[.16em] text-red-400">Featured vehicle</small>
                  <strong className="mt-2 block text-lg leading-tight">{carName(featured)}</strong>
                  <span className="mt-3 flex justify-between text-sm text-neutral-300"><b className="text-white">{priceLabel(featured)}</b>{mileageLabel(featured)}</span>
                </a>
              )}
            </div>
          </section>
          <section className="border-b border-neutral-200 bg-white">
            <div className="mx-auto grid w-[min(1240px,92vw)] divide-y divide-neutral-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <Trust icon={ShieldCheck} title="Live availability" text="Only vehicles currently available are shown." />
              <Trust icon={MapPinned} title="Correct location" text="Every viewing routes to the car’s actual lot." />
              <Trust icon={CalendarCheck} title="Book online" text="Choose from real-time appointment availability." />
            </div>
          </section>
        </>
      )}

      <main className="mx-auto w-[min(1240px,92vw)] py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-red-600">{inventoryPage ? "Vehicle marketplace" : "Fresh inventory"}</p>
            <h2 className="mt-2 text-4xl font-black tracking-[-.045em] sm:text-5xl">{inventoryPage ? "Browse available vehicles" : "Recently listed"}</h2>
            <p className="mt-3 text-neutral-600">{loading ? "Checking live inventory…" : `${cars.length} vehicle${cars.length === 1 ? "" : "s"} ready to view`}</p>
          </div>
          {!inventoryPage && <a href={`${WEBSITE_URL}/inventory`} className="inline-flex items-center gap-2 font-black text-red-600">View all inventory <ArrowRight size={17} /></a>}
        </div>

        {inventoryPage && (
          <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-black"><SlidersHorizontal size={17} /> Refine your search</p>
              {hasFilters && <button onClick={clearFilters} className="text-sm font-bold text-red-600">Clear all</button>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <form onSubmit={(event) => { event.preventDefault(); update("search", new FormData(event.currentTarget).get("search")); }}
                className="relative sm:col-span-2">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input name="search" defaultValue={current.get("search") || ""} placeholder="Search year, make, model…"
                  className="h-12 w-full rounded-md border border-neutral-300 pl-10 pr-3 outline-none transition focus:border-neutral-950" />
              </form>
              <Filter label="All locations" name="lot" values={filters.lots} current={current} update={update} />
              <Filter label="All makes" name="make" values={filters.makes} current={current} update={update} />
              <Filter label="All body styles" name="bodyType" values={filters.body_types} current={current} update={update} />
              <Filter label="All fuel types" name="fuel" values={filters.fuel_types} current={current} update={update} />
              <Filter label="All years" name="year" values={filters.years} current={current} update={update} />
              <select value={current.get("sort") || "newest"} onChange={(event) => update("sort", event.target.value)} className="h-12 rounded-md border border-neutral-300 bg-white px-3">
                <option value="newest">Recently updated</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="mileage">Lowest mileage</option>
              </select>
            </div>
          </section>
        )}

        {error && <p className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
        {loading ? <InventorySkeleton /> : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cars.slice(0, inventoryPage ? 500 : 9).map((car) => <CarCard key={car.id} car={car} />)}
          </div>
        )}
        {!loading && !cars.length && (
          <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-12 text-center">
            <Search className="mx-auto text-neutral-400" />
            <h3 className="mt-4 text-xl font-black">No vehicles match those filters</h3>
            <p className="mt-2 text-neutral-500">Clear a filter or broaden your search to see more inventory.</p>
            <button onClick={clearFilters} className="mt-5 rounded-md bg-neutral-950 px-5 py-3 font-bold text-white">Reset search</button>
          </div>
        )}
      </main>
      <footer className="border-t border-neutral-800 bg-neutral-950 py-10 text-neutral-400">
        <div className="mx-auto flex w-[min(1240px,92vw)] flex-wrap items-center justify-between gap-4 text-sm">
          <strong className="text-white">604 SELL CARS</strong>
          <span>Local inventory. Real locations. Simple booking.</span>
          <a href={LANDING_URL} className="font-bold text-white">Book a viewing →</a>
        </div>
      </footer>
    </div>
  );
}

function Trust({ icon: Icon, title, text }) {
  return (
    <div className="flex gap-4 px-5 py-6 sm:px-8">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600"><Icon size={19} /></span>
      <div><strong className="block text-sm">{title}</strong><p className="mt-1 text-xs leading-5 text-neutral-500">{text}</p></div>
    </div>
  );
}

function Filter({ label, name, values = [], current, update }) {
  return (
    <select value={current.get(name) || ""} onChange={(event) => update(name, event.target.value)}
      className="h-12 rounded-md border border-neutral-300 bg-white px-3">
      <option value="">{label}</option>
      {values.filter(Boolean).map((value) => <option key={value} value={value}>{value}</option>)}
    </select>
  );
}

function InventorySkeleton() {
  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading inventory">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="aspect-[16/10] animate-pulse bg-neutral-200" />
          <div className="space-y-3 p-5"><div className="h-3 w-28 animate-pulse rounded bg-neutral-200" /><div className="h-6 w-4/5 animate-pulse rounded bg-neutral-200" /><div className="h-10 animate-pulse rounded bg-neutral-100" /></div>
        </div>
      ))}
    </div>
  );
}
