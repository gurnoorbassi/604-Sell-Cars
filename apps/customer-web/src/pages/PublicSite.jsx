import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, CalendarCheck, CarFront, Check, ChevronRight, Gauge,
  MapPin, Search, ShieldCheck, SlidersHorizontal,
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
      : "604 Sell Cars | Shop Metro Vancouver Dealership Inventory";
    Promise.all([api(`/api/cars?${current.toString()}`), api("/api/filters")])
      .then(([rows, options]) => {
        setCars(rows);
        setFilters(options);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [current, inventoryPage]);

  const carsWithPhotos = cars.filter((car) => carImages(car).length);
  const featured = carsWithPhotos.find((car) => car.featured)
    || [...carsWithPhotos].sort((a, b) => Number(b.price_amount || 0) - Number(a.price_amount || 0))[0]
    || cars[0];
  const locations = [...new Map(cars.filter((car) => car.lot && car.lot_name).map((car) => [car.lot, {
    lot: car.lot,
    name: car.lot_name,
    address: car.lot_address,
  }])).values()];

  return (
    <div className="min-h-screen bg-[#090a0c] text-white">
      <SiteHeader />

      {!inventoryPage && <HomeHero featured={featured} filters={filters} loading={loading} total={cars.length} />}

      {inventoryPage ? (
        <InventoryPage cars={cars} filters={filters} current={current} loading={loading} error={error} />
      ) : (
        <HomePage cars={cars} filters={filters} locations={locations} loading={loading} error={error} />
      )}

      <SiteFooter />
    </div>
  );
}

function HomeHero({ featured, filters, loading, total }) {
  const heroImages = featured ? carImages(featured) : [];
  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10 bg-[#090a0c] text-white">
        <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-[#ef3f32]/10 blur-3xl" />
        <div className="mx-auto grid w-[min(1380px,92vw)] gap-10 pb-24 pt-12 sm:pt-16 lg:min-h-[620px] lg:grid-cols-[.82fr_1.18fr] lg:items-center lg:gap-14 lg:pb-28">
          <div className="relative z-10 max-w-[640px]">
            <p className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[.23em] text-[#ff6b60]">
              <span className="h-[2px] w-9 bg-[#ef3f32]" />
              Live dealership inventory
            </p>
            <h1 className="mt-5 max-w-3xl text-[clamp(2.6rem,5vw,4.35rem)] font-black leading-[.98] tracking-[-.052em]">
              Find the right car.<br /><span className="text-neutral-500">Know exactly where it is.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-neutral-300 sm:mt-6 sm:text-lg">
              Browse current vehicles from independent Metro Vancouver dealerships, compare the details that matter, and book your viewing online.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <a href={`${WEBSITE_URL}/inventory`} className="inline-flex items-center justify-center gap-2 bg-[#ef3f32] px-4 py-4 text-sm font-black text-white transition hover:bg-[#d92d22] sm:px-6">
                Shop all vehicles <ArrowRight size={17} />
              </a>
              <a href={LANDING_URL} className="flex items-center justify-center border border-white/30 px-4 py-4 text-sm font-bold text-white transition hover:bg-white/10 sm:px-6">
                Book a viewing
              </a>
            </div>
            <p className="mt-5 text-xs font-semibold text-neutral-500">
              {loading ? "Syncing current inventory…" : `${total} available vehicles across verified partner lots`}
            </p>
          </div>

          {featured && (
            <a href={`/cars/${featured.id}`} className="group relative block lg:translate-x-4">
              <div className="absolute -left-3 -top-3 h-24 w-24 border-l-2 border-t-2 border-[#ef3f32] sm:-left-5 sm:-top-5" />
              <div className="relative aspect-[16/10] overflow-hidden bg-neutral-800 shadow-[0_30px_90px_rgba(0,0,0,.45)]">
                <VehicleImage
                  sources={heroImages}
                  alt={carName(featured)}
                  loading="eager"
                  fetchPriority="high"
                  fallbackLabel="Vehicle photo coming soon"
                  className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-[1.025]"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent px-5 pb-5 pt-16 sm:px-7 sm:pb-7">
                  <small className="font-black uppercase tracking-[.17em] text-[#ff6b60]">Featured now</small>
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <span>
                      <strong className="block text-lg leading-tight sm:text-2xl">{carName(featured)}</strong>
                      <span className="mt-2 block text-xs font-semibold text-neutral-300 sm:text-sm">{featured.lot_name} · {mileageLabel(featured)}</span>
                    </span>
                    <b className="shrink-0 text-lg text-white sm:text-2xl">{priceLabel(featured)}</b>
                  </div>
                </div>
              </div>
              <span className="absolute -bottom-3 right-4 bg-[#ef3f32] px-4 py-2 text-[10px] font-black uppercase tracking-[.15em] text-white sm:right-6">
                View vehicle
              </span>
            </a>
          )}
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-9 w-[min(1180px,92vw)] overflow-hidden border border-white/10 bg-[#121417] shadow-[0_24px_80px_rgba(0,0,0,.45)]">
        <form action={`${WEBSITE_URL}/inventory`} method="get" className="grid lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          <SearchField name="search" label="What are you looking for?" placeholder="Make, model, or keyword" />
          <HeroSelect name="make" label="Make" values={filters.makes} placeholder="Any make" />
          <HeroSelect name="bodyType" label="Body style" values={filters.body_types} placeholder="Any body" />
          <HeroSelect name="maxPrice" label="Budget" values={priceOptions} placeholder="Any price" pairs />
          <button className="flex min-h-[78px] items-center justify-center gap-2 bg-[#ef3f32] px-7 text-sm font-black text-white transition hover:bg-[#d92d22]">
            <Search size={18} /> Search
          </button>
        </form>
        {loading && <span className="sr-only">Loading inventory filters</span>}
      </section>
    </>
  );
}

function HomePage({ cars, filters, locations, loading, error }) {
  const categories = filters.body_types.filter(Boolean).slice(0, 6);
  return (
    <main>
      <section className="mx-auto w-[min(1380px,94vw)] pb-16 pt-20 sm:pb-20 sm:pt-24">
        <SectionHeading eyebrow="Available now" title="Vehicles worth a closer look" text={loading ? "Checking live inventory…" : `${cars.length} vehicles currently available to view.`}>
          <a href={`${WEBSITE_URL}/inventory`} className="inline-flex items-center gap-2 text-sm font-black text-[#ff5a50]">
            View full inventory <ArrowRight size={16} />
          </a>
        </SectionHeading>
        {error && <ErrorMessage text={error} />}
        {loading ? <InventorySkeleton /> : (
          <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cars.slice(0, 8).map((car) => <CarCard key={car.id} car={car} />)}
          </div>
        )}
      </section>

      <section className="border-y border-white/10 bg-[#0d0f12] py-16 text-white sm:py-20">
        <div className="mx-auto w-[min(1380px,94vw)]">
          <SectionHeading dark eyebrow="Start with the shape" title="Shop by body style" text="Go straight to the kind of vehicle that fits your day-to-day." />
          <div className="mt-9 grid grid-cols-2 border-l border-t border-white/15 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => (
              <a key={category} href={`${WEBSITE_URL}/inventory?bodyType=${encodeURIComponent(category)}`}
                className="group min-h-36 border-b border-r border-white/15 p-5 transition hover:bg-[#ef3f32]">
                <CarFront className="text-[#ef3f32] transition group-hover:text-white" />
                <strong className="mt-10 flex items-center justify-between text-sm">
                  {category} <ChevronRight size={16} />
                </strong>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto grid w-[min(1380px,94vw)] gap-12 py-16 sm:py-24 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.22em] text-[#d92d22]">Built for a better search</p>
          <h2 className="mt-4 text-[clamp(2.3rem,4vw,4rem)] font-black leading-[.98] tracking-[-.055em]">
            One search.<br />Real dealership locations.
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-neutral-400">
            604 Sell Cars brings live partner inventory into one clear experience. You choose the vehicle; the system handles the correct location and available viewing times.
          </p>
        </div>
        <div className="grid border-t border-white/15 md:grid-cols-3">
          <Step number="01" icon={Search} title="Find the right vehicle" text="Filter live inventory by make, body style, year, price, mileage, and location." />
          <Step number="02" icon={CalendarCheck} title="Choose your time" text="Select an available hourly appointment from the next 14 days." />
          <Step number="03" icon={MapPin} title="Visit the correct lot" text="Your selected vehicle automatically determines the dealership and address." />
        </div>
      </section>

      {locations.length > 0 && (
        <section className="border-y border-white/10 bg-[#0d0f12] py-16">
          <div className="mx-auto w-[min(1380px,94vw)]">
            <SectionHeading eyebrow="Partner locations" title="Inventory across Metro Vancouver" text="Every public vehicle is tied to a verified physical dealership location." />
            <div className="mt-8 grid gap-px border border-white/10 bg-white/10 md:grid-cols-2">
              {locations.map((location) => (
                <a key={location.lot} href={`${WEBSITE_URL}/inventory?lot=${encodeURIComponent(location.lot)}`} className="group bg-[#121417] p-7 transition hover:bg-[#181b20]">
                  <span className="flex items-start gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center border border-white/10 bg-[#090a0c] text-[#ff5a50]"><MapPin size={19} /></span>
                    <span>
                      <strong className="block text-xl">{location.name}</strong>
                      <span className="mt-2 block text-sm leading-6 text-neutral-400">{location.address}</span>
                      <span className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.13em] text-[#ff5a50]">
                        View inventory <ArrowRight size={14} />
                      </span>
                    </span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-white/10 bg-[#090a0c] py-12 text-white">
        <div className="mx-auto flex w-[min(1180px,92vw)] flex-wrap items-center justify-between gap-6 border border-[#ef3f32]/35 bg-[linear-gradient(110deg,#17191d,#111216_60%,#241313)] p-7 sm:p-10">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ff6b60]">Found something worth seeing?</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">Book the vehicle, location, and time in one step.</h2>
          </div>
          <a href={LANDING_URL} className="inline-flex items-center gap-2 bg-[#ef3f32] px-6 py-4 text-sm font-black text-white transition hover:bg-[#d92d22]">
            Book a viewing <ArrowRight size={17} />
          </a>
        </div>
      </section>
    </main>
  );
}

function InventoryPage({ cars, filters, current, loading, error }) {
  const hasFilters = [...current.keys()].some((key) => key !== "sort");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  return (
    <main>
      <section className="border-b border-white/10 bg-[#0d0f12] py-11 text-white sm:py-14">
        <div className="mx-auto w-[min(1380px,94vw)]">
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#ff6b60]">Live vehicle marketplace</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="text-[clamp(2.5rem,5vw,4.7rem)] font-black leading-none tracking-[-.06em]">Browse inventory</h1>
              <p className="mt-4 text-sm text-neutral-400">
                {loading ? "Loading current vehicles…" : `${cars.length} vehicle${cars.length === 1 ? "" : "s"} match your search`}
              </p>
            </div>
            <a href={LANDING_URL} className="hidden items-center gap-2 border border-white/25 px-5 py-3 text-sm font-bold hover:bg-white/10 sm:flex">
              <CalendarCheck size={16} /> Book a viewing
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-[min(1380px,94vw)] gap-8 py-9 lg:grid-cols-[285px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[112px] lg:self-start">
          <button type="button" onClick={() => setMobileFiltersOpen((open) => !open)}
            className="flex w-full items-center justify-between border border-white/10 bg-[#121417] px-5 py-4 text-sm font-black lg:hidden"
            aria-expanded={mobileFiltersOpen}>
            <span className="flex items-center gap-2"><SlidersHorizontal size={17} /> Filter vehicles</span>
            <span className="text-xs font-bold text-[#ff5a50]">{mobileFiltersOpen ? "Close" : hasFilters ? "Edit" : "Open"}</span>
          </button>
          <form method="get" action={`${WEBSITE_URL}/inventory`} className={`${mobileFiltersOpen ? "block" : "hidden"} border border-t-0 border-white/10 bg-[#121417] lg:block lg:border-t`}>
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <p className="flex items-center gap-2 text-sm font-black"><SlidersHorizontal size={17} /> Filter vehicles</p>
              {hasFilters && <a href={`${WEBSITE_URL}/inventory`} className="text-xs font-bold text-[#d92d22]">Clear</a>}
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-1">
              <FilterInput label="Search" name="search" value={current.get("search")} placeholder="Make, model, keyword" />
              <FilterSelect label="Dealership location" name="lot" values={filters.lots} value={current.get("lot")} placeholder="All locations" />
              <FilterSelect label="Make" name="make" values={filters.makes} value={current.get("make")} placeholder="All makes" />
              <FilterSelect label="Body style" name="bodyType" values={filters.body_types} value={current.get("bodyType")} placeholder="All body styles" />
              <FilterSelect label="Fuel type" name="fuel" values={filters.fuel_types} value={current.get("fuel")} placeholder="All fuel types" />
              <FilterSelect label="Minimum year" name="minYear" values={filters.years} value={current.get("minYear")} placeholder="Any year" />
              <FilterSelect label="Maximum price" name="maxPrice" values={priceOptions} value={current.get("maxPrice")} placeholder="Any price" pairs />
              <FilterSelect label="Maximum mileage" name="maxMileage" values={mileageOptions} value={current.get("maxMileage")} placeholder="Any mileage" pairs />
              <input type="hidden" name="sort" value={current.get("sort") || "newest"} />
            </div>
            <button className="flex w-full items-center justify-center gap-2 bg-[#ef3f32] p-4 text-sm font-black text-white hover:bg-[#d92d22]">
              <Search size={17} /> Show vehicles
            </button>
          </form>
        </aside>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <p className="text-sm text-neutral-400">
              <strong className="text-white">{cars.length}</strong> results
            </p>
            <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-[.1em] text-neutral-500">
              Sort
              <select value={current.get("sort") || "newest"} onChange={(event) => {
                const next = readParams();
                next.set("sort", event.target.value);
                window.location.href = `${WEBSITE_URL}/inventory?${next}`;
              }} className="h-11 border border-white/10 bg-[#121417] px-3 text-sm font-semibold normal-case tracking-normal text-white">
                <option value="newest">Recently updated</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="mileage">Lowest mileage</option>
              </select>
            </label>
          </div>

          {error && <ErrorMessage text={error} />}
          {loading ? <InventorySkeleton columns={3} /> : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {cars.map((car) => <CarCard key={car.id} car={car} />)}
            </div>
          )}
          {!loading && !cars.length && (
            <div className="mt-6 border border-white/10 bg-[#121417] px-6 py-16 text-center">
              <Search className="mx-auto text-neutral-400" />
              <h2 className="mt-4 text-2xl font-black">No vehicles match those filters</h2>
              <p className="mt-2 text-sm text-neutral-500">Try a broader price, year, or body-style selection.</p>
              <a href={`${WEBSITE_URL}/inventory`} className="mt-6 inline-flex bg-[#ef3f32] px-5 py-3 text-sm font-bold text-white">Reset filters</a>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SectionHeading({ eyebrow, title, text, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#ff5a50]">{eyebrow}</p>
        <h2 className="mt-3 text-[clamp(2.1rem,3.7vw,3.6rem)] font-black leading-[1.02] tracking-[-.055em]">{title}</h2>
        {text && <p className="mt-3 text-sm leading-6 text-neutral-400">{text}</p>}
      </div>
      {children}
    </div>
  );
}

function Step({ number, icon: Icon, title, text }) {
  return (
    <article className="border-b border-white/15 py-6 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0">
      <span className="flex items-center justify-between text-[10px] font-black tracking-[.2em] text-neutral-400">
        {number} <Icon size={19} className="text-[#d92d22]" />
      </span>
      <h3 className="mt-9 text-lg font-black">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-neutral-400">{text}</p>
    </article>
  );
}

function SearchField({ name, label, placeholder }) {
  return (
    <label className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r">
      <span className="block text-[9px] font-black uppercase tracking-[.16em] text-neutral-400">{label}</span>
      <span className="mt-2 flex items-center gap-2">
        <Search size={16} className="text-neutral-400" />
        <input name={name} placeholder={placeholder} className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-white outline-none placeholder:font-normal placeholder:text-neutral-600" />
      </span>
    </label>
  );
}

function HeroSelect({ name, label, values, placeholder, pairs = false }) {
  return (
    <label className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r">
      <span className="block text-[9px] font-black uppercase tracking-[.16em] text-neutral-400">{label}</span>
      <select name={name} className="mt-1.5 w-full border-0 bg-[#121417] p-0 text-sm font-semibold text-white outline-none">
        <option value="">{placeholder}</option>
        {values.filter(Boolean).map((value) => {
          const [optionValue, optionLabel] = pairs ? value : [value, value];
          return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
        })}
      </select>
    </label>
  );
}

function FilterInput({ label, name, value, placeholder }) {
  return (
    <label className="text-[10px] font-black uppercase tracking-[.14em] text-neutral-500">
      {label}
      <span className="relative mt-2 block">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input name={name} defaultValue={value || ""} placeholder={placeholder} className="h-11 w-full border border-white/10 bg-[#0d0f12] pl-9 pr-3 text-sm font-normal normal-case tracking-normal text-white outline-none placeholder:text-neutral-600 focus:border-neutral-500" />
      </span>
    </label>
  );
}

function FilterSelect({ label, name, values = [], value, placeholder, pairs = false }) {
  return (
    <label className="text-[10px] font-black uppercase tracking-[.14em] text-neutral-500">
      {label}
      <select name={name} defaultValue={value || ""} className="mt-2 h-11 w-full border border-white/10 bg-[#0d0f12] px-3 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-neutral-500">
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

function InventorySkeleton({ columns = 4 }) {
  return (
    <div className={`mt-8 grid gap-5 sm:grid-cols-2 ${columns === 4 ? "lg:grid-cols-3 xl:grid-cols-4" : "xl:grid-cols-3"}`} aria-label="Loading inventory">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="overflow-hidden border border-white/10 bg-[#121417]">
          <div className="aspect-[16/10] animate-pulse bg-neutral-800" />
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
