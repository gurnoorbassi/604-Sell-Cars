import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, CalendarDays, Check, ChevronRight,
  MapPin, Search, SlidersHorizontal,
} from "lucide-react";
import CarCard from "../components/CarCard";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import VehicleImage from "../components/VehicleImage";
import { api, carImages, carName, mileageLabel, priceLabel } from "../lib/api";
import { LANDING_URL, WEBSITE_URL } from "../lib/links";

const readParams = () => new URLSearchParams(window.location.search);
const priceOptions = [
  ["15000", "Under $15,000"],
  ["20000", "Under $20,000"],
  ["30000", "Under $30,000"],
  ["50000", "Under $50,000"],
  ["75000", "Under $75,000"],
];
const mileageOptions = [
  ["50000", "Under 50,000 km"],
  ["100000", "Under 100,000 km"],
  ["150000", "Under 150,000 km"],
  ["200000", "Under 200,000 km"],
];
const isRollsRoyceGhost = (car) => /rolls[\s-]*royce.*ghost/i.test(`${car?.title || ""} ${carName(car || {})}`);

function coverImages(car) {
  const images = carImages(car);
  if (!isRollsRoyceGhost(car) || images.length < 2) return images;
  return [images[1], ...images.filter((_, index) => index !== 1)];
}

function mediaScore(car) {
  const labels = (car.labels || []).map((label) => String(label).toUpperCase());
  const markedGoodMedia = labels.includes("GOOD MEDIA") ? 1000 : 0;
  const photoCoverage = Math.min(Number(car.photo_count || carImages(car).length || 0), 100);
  return markedGoodMedia + photoCoverage;
}

export default function PublicSite() {
  const inventoryPage = window.location.pathname.includes("/inventory");
  const [cars, setCars] = useState([]);
  const [filters, setFilters] = useState({ lots: [], body_types: [], fuel_types: [], makes: [], years: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const current = useMemo(readParams, []);

  useEffect(() => {
    document.title = inventoryPage
      ? "Used Vehicles for Sale in Metro Vancouver | 604 Sell Cars"
      : "604 Sell Cars | Metro Vancouver Used Vehicle Inventory";
    Promise.all([api(`/api/cars?${current.toString()}`), api("/api/filters")])
      .then(([rows, options]) => {
        setCars(rows);
        setFilters(options);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [current, inventoryPage]);

  const carsWithPhotos = cars.filter((car) => carImages(car).length);
  const featured = carsWithPhotos.find(isRollsRoyceGhost)
    || carsWithPhotos.find((car) => car.featured)
    || carsWithPhotos.find((car) => Number(car.price_amount || 0) > 0)
    || cars[0];
  const locations = [...new Map(cars.filter((car) => car.lot && car.lot_name).map((car) => [car.lot, {
    lot: car.lot,
    name: car.lot_name,
    address: car.lot_address,
    count: cars.filter((item) => item.lot === car.lot).length,
  }])).values()];

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f5f5f3]">
      <SiteHeader />
      {inventoryPage ? (
        <InventoryPage cars={cars} filters={filters} current={current} loading={loading} error={error} />
      ) : (
        <HomePage cars={cars} featured={featured} filters={filters} locations={locations} loading={loading} error={error} />
      )}
      <SiteFooter />
    </div>
  );
}

function HomePage({ cars, featured, filters, locations, loading, error }) {
  const featuredImages = featured ? coverImages(featured) : [];
  const showcaseCars = useMemo(() => cars
    .filter((car) => car.id !== featured?.id && carImages(car).length)
    .sort((a, b) => mediaScore(b) - mediaScore(a))
    .slice(0, 6), [cars, featured?.id]);
  const categories = filters.body_types.filter(Boolean).slice(0, 7);
  return (
    <main>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="mx-auto grid w-[min(1320px,92vw)] gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)] lg:items-center lg:gap-16 lg:py-20">
          <div className="relative z-10">
            <p className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[.22em] text-[#ff5a50]">
              <span className="h-px w-8 bg-[#ef3f32]" /> Metro Vancouver dealership inventory
            </p>
            <h1 className="mt-6 max-w-3xl text-[clamp(2.8rem,5.4vw,5rem)] font-black leading-[.94] tracking-[-.06em]">
              The car you want.<br /><span className="text-neutral-500">The location it’s actually at.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-300 sm:text-lg">
              Search current vehicles from independent dealerships, see the exact viewing location, and reserve a time before you make the drive.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-5 text-xs font-semibold text-neutral-400">
              <span className="flex items-center gap-2"><Check size={14} className="text-[#ff5a50]" /> Live availability</span>
              <span className="flex items-center gap-2"><Check size={14} className="text-[#ff5a50]" /> Exact dealership address</span>
              <span className="flex items-center gap-2"><Check size={14} className="text-[#ff5a50]" /> Self-scheduled viewings</span>
            </div>
          </div>

          <form action={`${WEBSITE_URL}/inventory`} method="get" className="relative z-10 border border-white/10 bg-[#101216] p-5 shadow-[0_30px_90px_rgba(0,0,0,.42)] sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.18em] text-[#ff5a50]">Search live inventory</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-.04em]">Start with what matters.</h2>
              </div>
              <span className="grid h-10 w-10 shrink-0 place-items-center border border-white/10 bg-[#08090b] text-neutral-400"><Search size={17} /></span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <FilterInput label="Make or model" name="search" placeholder="e.g. Honda Civic" />
              <FilterSelect label="Dealership" name="lot" values={filters.lots} placeholder="Every location" />
              <FilterSelect label="Body style" name="bodyType" values={filters.body_types} placeholder="Every body style" />
              <FilterSelect label="Maximum price" name="maxPrice" values={priceOptions} placeholder="Any price" pairs />
            </div>
            <button className="mt-5 flex h-12 w-full items-center justify-center gap-2 bg-[#ef3f32] px-5 text-sm font-black text-white transition hover:bg-[#d92d22]">
              See matching vehicles <ArrowRight size={16} />
            </button>
            <p className="mt-4 text-center text-[11px] font-semibold text-neutral-500">
              {loading ? "Checking current inventory…" : `${cars.length} vehicles currently available`}
            </p>
          </form>
        </div>
      </section>

      {featured && (
        <section className="border-b border-white/10 bg-[#0d0f12]">
          <div className="mx-auto grid w-[min(1320px,92vw)] lg:grid-cols-[1.35fr_.65fr]">
            <a href={`/cars/${featured.id}`} className="group relative block min-h-[340px] overflow-hidden border-x border-white/10 bg-[radial-gradient(circle_at_center,#1a1d22_0%,#08090b_74%)] sm:min-h-[430px] lg:border-r-0">
              <VehicleImage sources={featuredImages} alt={carName(featured)} loading="eager" fetchPriority="high"
                fallbackLabel="Vehicle photo coming soon"
                className="absolute inset-0 h-full w-full object-cover object-center transition duration-700 group-hover:scale-[1.015] lg:object-contain" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-black/20" />
              <div className="absolute left-5 top-5 bg-[#ef3f32] px-3 py-2 text-[9px] font-black uppercase tracking-[.16em] text-white sm:left-7 sm:top-7">High-end feature</div>
              <span className="absolute bottom-5 right-5 grid h-12 w-12 place-items-center bg-white text-black transition group-hover:bg-[#ef3f32] group-hover:text-white sm:bottom-7 sm:right-7"><ArrowRight size={18} /></span>
            </a>
            <div className="flex flex-col justify-between border-x border-white/10 bg-[#14171b] p-6 sm:p-8 lg:border-l-0 lg:p-10">
              <div>
                <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.16em] text-[#ff5a50]"><MapPin size={13} />{featured.lot_name}</p>
                <h2 className="mt-4 text-[clamp(2rem,3.4vw,3.4rem)] font-black leading-[1.02] tracking-[-.055em]">{carName(featured)}</h2>
                <p className="mt-3 text-sm font-semibold text-neutral-400">{mileageLabel(featured)}</p>
              </div>
              <div className="mt-10 border-t border-white/10 pt-6">
                <small className="text-[9px] font-black uppercase tracking-[.15em] text-neutral-500">Listed price</small>
                <strong className="mt-1 block text-3xl font-black tracking-[-.04em]">{priceLabel(featured)}</strong>
                <a href={`/cars/${featured.id}`} className="mt-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.13em] text-white">
                  View full details <ChevronRight size={14} className="text-[#ff5a50]" />
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto w-[min(1320px,92vw)] py-16 sm:py-20">
        <SectionHeader kicker="Available now" title="Explore more inventory"
          text={loading ? "Loading current inventory…" : `Browse ${cars.length} vehicles across ${locations.length} dealership locations.`}>
          <a href={`${WEBSITE_URL}/inventory`} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.13em] text-white">
            View all inventory <ArrowRight size={15} className="text-[#ff5a50]" />
          </a>
        </SectionHeader>
        {error && <ErrorMessage text={error} />}
        {loading ? <InventorySkeleton /> : (
          <div className="mt-8 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {showcaseCars.map((car) => <CarCard key={car.id} car={car} />)}
          </div>
        )}
        <div className="mt-10 flex flex-wrap gap-2 border-t border-white/10 pt-5">
          <a href={`${WEBSITE_URL}/inventory`} className="border border-white/15 bg-white px-4 py-2.5 text-xs font-black text-black">All vehicles</a>
          {categories.map((category) => (
            <a key={category} href={`${WEBSITE_URL}/inventory?bodyType=${encodeURIComponent(category)}`}
              className="border border-white/10 bg-[#101216] px-4 py-2.5 text-xs font-bold text-neutral-300 transition hover:border-white/25 hover:text-white">
              {category}
            </a>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="border-y border-white/10 bg-[#0d0f12]">
        <div className="mx-auto grid w-[min(1320px,92vw)] lg:grid-cols-[.8fr_1.2fr]">
          <div className="border-x border-white/10 p-7 sm:p-10 lg:p-12">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ff5a50]">A clearer way to shop</p>
            <h2 className="mt-4 max-w-lg text-[clamp(2rem,3.6vw,3.5rem)] font-black leading-[1.02] tracking-[-.05em]">Know the vehicle, the lot, and the time before you leave home.</h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-neutral-400">604 Sell Cars keeps the dealership location attached to the vehicle from the first search through the final booking confirmation.</p>
          </div>
          <div className="border-x border-t border-white/10 lg:border-l-0 lg:border-t-0">
            <TrustRow number="01" icon={Search} title="Search current inventory" text="Filter by the details that actually affect your purchase: price, year, mileage, body style, and lot." />
            <TrustRow number="02" icon={MapPin} title="See the real viewing location" text="Every available vehicle is shown with its dealership name and full street address." />
            <TrustRow number="03" icon={CalendarDays} title="Reserve your own time" text="Choose an open hourly appointment from the next 14 days without waiting for a callback." />
          </div>
        </div>
      </section>

      {locations.length > 0 && (
        <section className="mx-auto w-[min(1320px,92vw)] py-16 sm:py-20">
          <SectionHeader kicker="Dealership network" title="Shop by location" text="Each vehicle stays connected to the physical lot where it can be viewed." />
          <div className="mt-8 grid border-l border-t border-white/10 md:grid-cols-2">
            {locations.map((location) => (
              <a key={location.lot} href={`${WEBSITE_URL}/inventory?lot=${encodeURIComponent(location.lot)}`}
                className="group border-b border-r border-white/10 bg-[#101216] p-6 transition hover:bg-[#15181c] sm:p-7">
                <span className="flex items-start justify-between gap-4">
                  <span>
                    <small className="text-[9px] font-black uppercase tracking-[.16em] text-[#ff5a50]">{location.count} available</small>
                    <strong className="mt-3 block text-xl font-black tracking-[-.03em]">{location.name}</strong>
                    <span className="mt-2 block max-w-sm text-sm leading-6 text-neutral-400">{location.address}</span>
                  </span>
                  <span className="grid h-10 w-10 shrink-0 place-items-center border border-white/10 text-neutral-400 transition group-hover:border-[#ef3f32] group-hover:text-[#ff5a50]"><ArrowRight size={16} /></span>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-white/10 bg-[#ef3f32] text-white">
        <div className="mx-auto flex w-[min(1320px,92vw)] flex-wrap items-center justify-between gap-6 py-9">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/70">Ready to see it in person?</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-.04em] sm:text-3xl">Choose the car. Choose the time. We’ll handle the location.</h2>
          </div>
          <a href={LANDING_URL} className="inline-flex h-12 items-center gap-2 bg-white px-6 text-sm font-black text-black">
            Book a viewing <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </main>
  );
}

function InventoryPage({ cars, filters, current, loading, error }) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const hasFilters = [...current.keys()].some((key) => key !== "sort");
  return (
    <main>
      <section className="border-b border-white/10 bg-[#0d0f12]">
        <div className="mx-auto w-[min(1320px,92vw)] py-10 sm:py-12">
          <p className="text-[9px] font-black uppercase tracking-[.19em] text-[#ff5a50]">Live dealership inventory</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="text-[clamp(2.4rem,4.5vw,4rem)] font-black leading-none tracking-[-.055em]">Find your next vehicle</h1>
              <p className="mt-4 text-sm text-neutral-400">{loading ? "Checking current availability…" : `${cars.length} vehicle${cars.length === 1 ? "" : "s"} match your search`}</p>
            </div>
            <a href={LANDING_URL} className="hidden h-11 items-center gap-2 border border-white/15 px-5 text-sm font-bold transition hover:bg-white/5 sm:flex"><CalendarDays size={16} />Book a viewing</a>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-[min(1320px,92vw)] gap-7 py-8 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[112px] lg:self-start">
          <button type="button" onClick={() => setMobileFiltersOpen((open) => !open)}
            className="flex w-full items-center justify-between border border-white/10 bg-[#101216] px-5 py-4 text-sm font-black lg:hidden"
            aria-expanded={mobileFiltersOpen}>
            <span className="flex items-center gap-2"><SlidersHorizontal size={17} />Filter inventory</span>
            <span className="text-xs text-[#ff5a50]">{mobileFiltersOpen ? "Close" : hasFilters ? "Edit" : "Open"}</span>
          </button>
          <form method="get" action={`${WEBSITE_URL}/inventory`} className={`${mobileFiltersOpen ? "block" : "hidden"} border border-t-0 border-white/10 bg-[#101216] lg:block lg:border-t`}>
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <p className="flex items-center gap-2 text-sm font-black"><SlidersHorizontal size={16} />Refine search</p>
              {hasFilters && <a href={`${WEBSITE_URL}/inventory`} className="text-xs font-bold text-[#ff5a50]">Clear</a>}
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-1">
              <FilterInput label="Search" name="search" value={current.get("search")} placeholder="Make, model, keyword" />
              <FilterSelect label="Dealership" name="lot" values={filters.lots} value={current.get("lot")} placeholder="Every location" />
              <FilterSelect label="Make" name="make" values={filters.makes} value={current.get("make")} placeholder="Every make" />
              <FilterSelect label="Body style" name="bodyType" values={filters.body_types} value={current.get("bodyType")} placeholder="Every body style" />
              <FilterSelect label="Fuel type" name="fuel" values={filters.fuel_types} value={current.get("fuel")} placeholder="Every fuel type" />
              <FilterSelect label="Minimum year" name="minYear" values={filters.years} value={current.get("minYear")} placeholder="Any year" />
              <FilterSelect label="Maximum price" name="maxPrice" values={priceOptions} value={current.get("maxPrice")} placeholder="Any price" pairs />
              <FilterSelect label="Maximum mileage" name="maxMileage" values={mileageOptions} value={current.get("maxMileage")} placeholder="Any mileage" pairs />
              <input type="hidden" name="sort" value={current.get("sort") || "newest"} />
            </div>
            <button className="flex h-12 w-full items-center justify-center gap-2 bg-[#ef3f32] text-sm font-black text-white transition hover:bg-[#d92d22]"><Search size={16} />Apply filters</button>
          </form>
        </aside>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <p className="text-sm text-neutral-400"><strong className="text-white">{cars.length}</strong> results</p>
            <label className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[.14em] text-neutral-500">
              Sort by
              <select value={current.get("sort") || "newest"} onChange={(event) => {
                const next = readParams();
                next.set("sort", event.target.value);
                window.location.href = `${WEBSITE_URL}/inventory?${next}`;
              }} className="h-10 border border-white/10 bg-[#101216] px-3 text-sm font-semibold normal-case tracking-normal text-white">
                <option value="newest">Recently updated</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="mileage">Lowest mileage</option>
              </select>
            </label>
          </div>
          {error && <ErrorMessage text={error} />}
          {loading ? <InventorySkeleton columns={3} /> : (
            <div className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
              {cars.map((car) => <CarCard key={car.id} car={car} />)}
            </div>
          )}
          {!loading && !cars.length && (
            <div className="mt-6 border border-white/10 bg-[#101216] px-6 py-16 text-center">
              <Search className="mx-auto text-neutral-600" />
              <h2 className="mt-4 text-2xl font-black">No vehicles match those filters</h2>
              <p className="mt-2 text-sm text-neutral-500">Try a broader price, year, or body-style selection.</p>
              <a href={`${WEBSITE_URL}/inventory`} className="mt-6 inline-flex bg-white px-5 py-3 text-sm font-black text-black">Reset filters</a>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SectionHeader({ kicker, title, text, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[.2em] text-[#ff5a50]">{kicker}</p>
        <h2 className="mt-3 text-[clamp(2rem,3.5vw,3.35rem)] font-black leading-[1.02] tracking-[-.05em]">{title}</h2>
        {text && <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">{text}</p>}
      </div>
      {children}
    </div>
  );
}

function TrustRow({ number, icon: Icon, title, text }) {
  return (
    <article className="grid gap-4 border-b border-white/10 p-6 last:border-b-0 sm:grid-cols-[55px_44px_1fr] sm:items-start sm:p-8">
      <span className="text-[10px] font-black tracking-[.2em] text-neutral-600">{number}</span>
      <span className="grid h-10 w-10 place-items-center border border-white/10 bg-[#08090b] text-[#ff5a50]"><Icon size={17} /></span>
      <div><h3 className="font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-neutral-400">{text}</p></div>
    </article>
  );
}

function FilterInput({ label, name, value, placeholder }) {
  return (
    <label className="text-[9px] font-black uppercase tracking-[.14em] text-neutral-500">
      {label}
      <span className="relative mt-2 block">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input name={name} defaultValue={value || ""} placeholder={placeholder}
          className="h-11 w-full border border-white/10 bg-[#08090b] pl-9 pr-3 text-sm font-normal normal-case tracking-normal text-white outline-none placeholder:text-neutral-600 focus:border-neutral-500" />
      </span>
    </label>
  );
}

function FilterSelect({ label, name, values = [], value, placeholder, pairs = false }) {
  return (
    <label className="text-[9px] font-black uppercase tracking-[.14em] text-neutral-500">
      {label}
      <select name={name} defaultValue={value || ""}
        className="mt-2 h-11 w-full border border-white/10 bg-[#08090b] px-3 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-neutral-500">
        <option value="">{placeholder}</option>
        {values.filter(Boolean).map((item) => {
          const [optionValue, optionLabel] = pairs ? item : [item, item];
          return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
        })}
      </select>
    </label>
  );
}

function ErrorMessage({ text }) {
  return <p className="mt-7 border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">{text}</p>;
}

function InventorySkeleton({ columns = 3 }) {
  return (
    <div className={`mt-8 grid gap-5 sm:grid-cols-2 ${columns === 3 ? "xl:grid-cols-3" : "lg:grid-cols-3"}`} aria-label="Loading inventory">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="overflow-hidden border border-white/10 bg-[#101216]">
          <div className="aspect-[4/3] animate-pulse bg-neutral-900" />
          <div className="space-y-3 p-5">
            <div className="h-3 w-28 animate-pulse bg-neutral-800" />
            <div className="h-6 w-4/5 animate-pulse bg-neutral-800" />
            <div className="h-10 animate-pulse bg-neutral-900" />
          </div>
        </div>
      ))}
    </div>
  );
}
