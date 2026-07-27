import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Camera, Check, ChevronRight, MapPin, Search,
  ShieldCheck, SlidersHorizontal, Upload,
} from "lucide-react";
import CarCard from "../components/CarCard";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import VehicleImage from "../components/VehicleImage";
import { api, carImages, carName, priceLabel } from "../lib/api";
import { WEBSITE_URL } from "../lib/links";

const readParams = () => new URLSearchParams(window.location.search);
const priceOptions = [
  ["15000", "Under $15,000"],
  ["20000", "Under $20,000"],
  ["30000", "Under $30,000"],
  ["50000", "Under $50,000"],
  ["75000", "Under $75,000"],
  ["100000", "Under $100,000"],
];
const mileageOptions = [
  ["50000", "Under 50,000 km"],
  ["100000", "Under 100,000 km"],
  ["150000", "Under 150,000 km"],
  ["200000", "Under 200,000 km"],
];
const bodyTypes = [
  ["SUV", /suv|crossover/i],
  ["Sedan", /sedan/i],
  ["Truck", /truck|pickup/i],
  ["Coupe", /coupe/i],
  ["EV", /electric|ev/i],
];

export default function PublicSite() {
  const inventoryPage = window.location.pathname.includes("/inventory");
  const [cars, setCars] = useState([]);
  const [heroCars, setHeroCars] = useState([]);
  const [filters, setFilters] = useState({ cities: [], body_types: [], fuel_types: [], makes: [], years: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const current = useMemo(readParams, []);

  useEffect(() => {
    document.title = inventoryPage
      ? "Live Used Vehicle Inventory | 604 Sell Cars"
      : "604 Sell Cars | Find It. We Reserve It. You Drive It.";
    Promise.allSettled([
      api(`/api/cars?${current.toString()}`),
      api("/api/filters"),
      inventoryPage ? Promise.resolve([]) : api("/api/cars?hero=1"),
    ])
      .then(([carsResult, filtersResult, heroResult]) => {
        if (carsResult.status === "fulfilled") {
          setCars(carsResult.value);
          setError("");
        } else {
          setError(carsResult.reason?.message || "Inventory is temporarily unavailable.");
        }
        if (filtersResult.status === "fulfilled") {
          setFilters(filtersResult.value);
        }
        if (heroResult.status === "fulfilled") {
          setHeroCars(heroResult.value);
        }
      })
      .finally(() => setLoading(false));
  }, [current, inventoryPage]);

  useEffect(() => {
    if (loading) return undefined;
    const cards = [...document.querySelectorAll(".reveal-card, .motion-section")];
    if (!("IntersectionObserver" in window)) {
      cards.forEach((card) => card.classList.add("is-visible"));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [loading, cars]);

  useEffect(() => {
    let frame = 0;
    const updateMotion = () => {
      frame = 0;
      const scrollTop = window.scrollY;
      const scrollRange = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      document.documentElement.style.setProperty("--page-progress", String(Math.min(scrollTop / scrollRange, 1)));
      document.documentElement.style.setProperty("--hero-shift", `${Math.min(scrollTop * 0.14, 92)}px`);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateMotion);
    };
    updateMotion();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      document.documentElement.style.removeProperty("--page-progress");
      document.documentElement.style.removeProperty("--hero-shift");
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f5f5f3]">
      <div className="scroll-progress" aria-hidden="true" />
      <SiteHeader />
      {inventoryPage
        ? <InventoryPage cars={cars} filters={filters} current={current} loading={loading} error={error} />
        : <HomePage cars={cars} heroCars={heroCars} filters={filters} loading={loading} error={error} />}
      <SiteFooter />
    </div>
  );
}

function HomePage({ cars, heroCars, filters, loading, error }) {
  const [heroReady, setHeroReady] = useState(false);
  const heroCarById = new Map(heroCars.map((car) => [car.id, car]));
  const displayCars = cars.map((car) => heroCarById.get(car.id) || car);
  const photographed = displayCars.filter((car) => carImages(car).length);
  const highEndCars = [...(heroCars.length ? heroCars : photographed)]
    .filter((car) => carImages(car).length)
    .sort((a, b) => Number(b.price_amount || 0) - Number(a.price_amount || 0))
    .slice(0, 10);
  const heroCoverUrls = highEndCars.map((car) => heroImageSources(car)[0]).filter(Boolean);
  const heroCoverKey = heroCoverUrls.join("|");
  const featured = [...photographed]
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))
      || Number(b.price_amount || 0) - Number(a.price_amount || 0))
    .slice(0, 8);

  useEffect(() => {
    setHeroReady(false);
    if (!heroCoverUrls.length) return undefined;
    let cancelled = false;
    const preload = heroCoverUrls.slice(0, 5).map((source) => new Promise((resolve) => {
      const image = new Image();
      const timeout = window.setTimeout(resolve, 5_000);
      const finish = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      image.onload = finish;
      image.onerror = finish;
      image.src = source;
    }));
    Promise.all(preload).then(() => {
      if (!cancelled) setHeroReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [heroCoverKey]);

  return (
    <main>
      <section className="hero-stage relative min-h-[690px] overflow-hidden border-b border-white/10 sm:min-h-[760px]">
        {highEndCars.length ? (
          <div className="hero-media absolute inset-0">
            <div className={`hero-gallery-track${heroReady ? " is-ready" : ""}`}>
              {[false, true].map((duplicate) => (
                <div className="hero-gallery-group" aria-hidden={duplicate || undefined} key={duplicate ? "repeat" : "original"}>
                  {highEndCars.map((car, index) => (
                    <div className="hero-gallery-slide" key={`${duplicate ? "repeat" : "original"}-${car.id}`}>
                      <VehicleImage
                        sources={heroImageSources(car)}
                        alt=""
                        aria-hidden="true"
                        loading={!duplicate ? "eager" : "lazy"}
                        fetchPriority={!duplicate && index === 0 ? "high" : undefined}
                        className="hero-gallery-image h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : <div className="absolute inset-0 bg-[#111419]" />}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,4,5,.89)_0%,rgba(3,4,5,.72)_46%,rgba(3,4,5,.58)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#08090b_0%,rgba(8,9,11,.18)_45%,rgba(8,9,11,.3)_100%)]" />
        <div className="relative mx-auto flex min-h-[690px] w-[min(1340px,92vw)] flex-col justify-center pb-28 pt-16 sm:min-h-[760px]">
          <p className="hero-line hero-line-1 text-[10px] font-black uppercase tracking-[.24em] text-[#ff655a]">604SELLSCARS · Live marketplace inventory</p>
          <h1 className="hero-line hero-line-2 mt-5 max-w-4xl text-[clamp(2.65rem,6vw,5.5rem)] font-black leading-[.94] tracking-[-.06em]">
            Search live vehicles from independent dealerships and private sellers.
          </h1>
          <p className="hero-line hero-line-3 mt-6 max-w-2xl text-base leading-7 text-neutral-200 sm:text-xl sm:leading-8">
            See the approximate location and have our team reserve the vehicle for you before you make the drive.
          </p>
          <div className="hero-line hero-line-4 mt-7 flex flex-wrap gap-3">
            <a href={`${WEBSITE_URL}/inventory`} className="inline-flex min-h-12 items-center gap-2 bg-[#ef4538] px-6 text-sm font-black text-white transition hover:bg-[#d9362b]">
              Browse inventory <ArrowRight size={16} />
            </a>
            <a href="#list-with-us" className="inline-flex min-h-12 items-center border border-white/30 bg-black/25 px-6 text-sm font-black text-white backdrop-blur transition hover:bg-white hover:text-black">
              List your vehicle
            </a>
          </div>

          <form action={`${WEBSITE_URL}/inventory`} method="get" className="hero-line hero-line-4 mt-10 grid max-w-5xl border border-white/15 bg-[#0a0c0f]/92 p-3 shadow-[0_30px_80px_rgba(0,0,0,.48)] backdrop-blur sm:grid-cols-2 lg:grid-cols-[1.3fr_.8fr_.8fr_.8fr_auto]">
            <HeroField name="search" label="Make or model" placeholder="Honda Civic" />
            <HeroSelect name="make" label="Make" values={filters.makes} placeholder="Any make" />
            <HeroSelect name="maxPrice" label="Budget" values={priceOptions} placeholder="Any budget" pairs />
            <HeroSelect name="city" label="Area" values={filters.cities} placeholder="Any city" />
            <button className="mt-2 flex min-h-12 items-center justify-center gap-2 bg-white px-5 text-sm font-black text-black transition hover:bg-[#ef4538] hover:text-white lg:mt-0">
              <Search size={16} />Search
            </button>
          </form>
        </div>
        <div className="motion-ticker absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#08090b]/90 py-4 backdrop-blur" aria-label="Marketplace benefits">
          <div className="motion-ticker-track">
            <TickerContent />
            <TickerContent ariaHidden />
          </div>
        </div>
      </section>

      <section className="motion-section mx-auto w-[min(1340px,92vw)] py-16 sm:py-24">
        <SectionHeader kicker="Selected inventory" title="Vehicles worth a closer look." text="Live availability, clean media, and approximate location—nothing that sends you chasing the wrong car.">
          <a href={`${WEBSITE_URL}/inventory`} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-white">View all <ArrowRight size={14} /></a>
        </SectionHeader>
        {error && <ErrorMessage text={error} />}
        {loading ? <InventorySkeleton columns={4} /> : (
          <div className="mt-9 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((car, index) => <div key={car.id} style={{ "--reveal-delay": `${index * 60}ms` }}><CarCard car={car} /></div>)}
          </div>
        )}
      </section>

      <section className="border-y border-white/10 bg-[#0d0f12] py-16 sm:py-24">
        <div className="motion-section mx-auto w-[min(1340px,92vw)]">
          <SectionHeader kicker="Start with the shape" title="Browse by body type." />
          <div className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-5">
            {bodyTypes.map(([label, matcher]) => {
              const car = photographedForType(displayCars, matcher);
              const image = carImages(car || {})[0];
              return (
                <a key={label} href={`${WEBSITE_URL}/inventory?${label === "EV" ? "fuel=Electric" : `bodyType=${encodeURIComponent(label)}`}`} className="group relative aspect-[4/5] overflow-hidden border border-white/10 bg-[#15181c]">
                  {image && <VehicleImage sources={carImages(car)} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4 text-lg font-black">{label}<ChevronRight size={18} /></span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="motion-section mx-auto w-[min(1340px,92vw)] py-16 sm:py-24">
        <SectionHeader kicker="No wasted drives" title="Find it. We reserve it. You drive it." />
        <div className="mt-10 grid border border-white/10 md:grid-cols-3">
          <Step number="01" title="Find it" text="Search live inventory by vehicle, budget, body style, and city." />
          <Step number="02" title="We reserve it" text="Our team checks availability and confirms the viewing." />
          <Step number="03" title="You drive it" text="Get the handoff details only after the vehicle is verified." />
        </div>
      </section>

      <SellerSection cars={cars} />
    </main>
  );
}

function InventoryPage({ cars, filters, current, loading, error }) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const hasFilters = [...current.keys()].some((key) => current.get(key));

  return (
    <main>
      <section className="border-b border-white/10 bg-[#0d0f12]">
        <div className="mx-auto w-[min(1340px,92vw)] py-12 sm:py-16">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ff655a]">Live inventory</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="text-[clamp(2.6rem,5vw,4.7rem)] font-black leading-[.96] tracking-[-.06em]">Find the one worth driving.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-400">Every result is currently available and shows only its approximate area.</p>
            </div>
            <span className="text-sm text-neutral-500"><strong className="text-white">{cars.length}</strong> vehicles</span>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-[min(1340px,92vw)] gap-7 py-8 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[92px] lg:self-start">
          <button type="button" onClick={() => setMobileFiltersOpen((open) => !open)} className="flex w-full items-center justify-between border border-white/10 bg-[#111418] px-5 py-4 text-sm font-black lg:hidden" aria-expanded={mobileFiltersOpen}>
            <span className="flex items-center gap-2"><SlidersHorizontal size={17} />Filter inventory</span>
            <span className="text-xs text-[#ff655a]">{mobileFiltersOpen ? "Close" : hasFilters ? "Edit" : "Open"}</span>
          </button>
          <form method="get" action={`${WEBSITE_URL}/inventory`} className={`${mobileFiltersOpen ? "block" : "hidden"} border border-t-0 border-white/10 bg-[#111418] lg:block lg:border-t`}>
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <p className="flex items-center gap-2 text-sm font-black"><SlidersHorizontal size={16} />Refine</p>
              {hasFilters && <a href={`${WEBSITE_URL}/inventory`} className="text-xs font-bold text-[#ff655a]">Clear</a>}
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-1">
              <FilterInput label="Search" name="search" value={current.get("search")} placeholder="Make, model, keyword" />
              <FilterSelect label="Approximate area" name="city" values={filters.cities} value={current.get("city")} placeholder="Every city" />
              <FilterSelect label="Make" name="make" values={filters.makes} value={current.get("make")} placeholder="Every make" />
              <FilterSelect label="Body style" name="bodyType" values={filters.body_types} value={current.get("bodyType")} placeholder="Every body style" />
              <FilterSelect label="Fuel type" name="fuel" values={filters.fuel_types} value={current.get("fuel")} placeholder="Every fuel type" />
              <FilterSelect label="Minimum year" name="minYear" values={filters.years} value={current.get("minYear")} placeholder="Any year" />
              <FilterSelect label="Maximum price" name="maxPrice" values={priceOptions} value={current.get("maxPrice")} placeholder="Any price" pairs />
              <FilterSelect label="Maximum mileage" name="maxMileage" values={mileageOptions} value={current.get("maxMileage")} placeholder="Any mileage" pairs />
              <input type="hidden" name="sort" value={current.get("sort") || "recent"} />
            </div>
            <button className="flex h-12 w-full items-center justify-center gap-2 bg-[#ef4538] text-sm font-black text-white transition hover:bg-[#d9362b]"><Search size={16} />Apply filters</button>
          </form>
        </aside>

        <section className="inventory-results">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <p className="text-sm text-neutral-400"><strong className="text-white">{cars.length}</strong> results</p>
            <label className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[.14em] text-neutral-500">
              Sort
              <select value={current.get("sort") || "recent"} onChange={(event) => {
                const next = readParams();
                next.set("sort", event.target.value);
                window.location.href = `${WEBSITE_URL}/inventory?${next}`;
              }} className="h-10 border border-white/10 bg-[#111418] px-3 text-sm font-semibold normal-case tracking-normal text-white">
                <option value="recent">Recently updated</option>
                <option value="newest">Newly added</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="mileage">Lowest mileage</option>
              </select>
            </label>
          </div>
          {error && <ErrorMessage text={error} />}
          {loading ? <InventorySkeleton columns={3} /> : (
            <div className="inventory-grid mt-6 grid gap-x-5 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
              {cars.map((car, index) => <div key={car.id} style={{ "--reveal-delay": `${(index % 9) * 60}ms` }}><CarCard car={car} /></div>)}
            </div>
          )}
          {!loading && !cars.length && (
            <div className="mt-6 border border-white/10 bg-[#111418] px-6 py-16 text-center">
              <Search className="mx-auto text-neutral-600" />
              <h2 className="mt-4 text-2xl font-black">No vehicles match those filters</h2>
              <p className="mt-2 text-sm text-neutral-500">Try a broader budget, year, or body style.</p>
              <a href={`${WEBSITE_URL}/inventory`} className="mt-6 inline-flex bg-white px-5 py-3 text-sm font-black text-black">Reset filters</a>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SellerSection() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await api("/api/seller-leads", { method: "POST", body: new FormData(event.currentTarget) });
      setMessage(result.message);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="list-with-us" className="relative overflow-hidden border-t border-white/10 bg-[#111418] py-16 sm:py-24">
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(239,69,56,.13),transparent_65%)]" />
      <div className="motion-section relative mx-auto grid w-[min(1180px,92vw)] gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ff655a]">Private sellers</p>
          <h2 className="mt-3 text-[clamp(2.4rem,4.5vw,4.4rem)] font-black leading-[.97] tracking-[-.06em]">Put your vehicle in front of the 604 audience.</h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-neutral-400">Send the basics and a few clear photos. Our team will review the vehicle and contact you about the next step.</p>
          <div className="mt-7 flex items-start gap-3 text-sm text-neutral-400"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-emerald-400" />Your photos stay private until our team approves a listing.</div>
        </div>
        <form onSubmit={submit} className="grid gap-4 border border-white/10 bg-[#090b0e] p-5 sm:grid-cols-2 sm:p-7">
          <SellerField label="Full name" name="name" placeholder="Your name" />
          <SellerField label="Phone" name="phone" type="tel" placeholder="(604) 555-0123" />
          <SellerField label="Vehicle" name="vehicle" placeholder="Year, make, model, mileage" wide />
          <label className="text-[10px] font-black uppercase tracking-[.13em] text-neutral-500 sm:col-span-2">
            Photos
            <span className="mt-2 flex min-h-24 cursor-pointer items-center justify-center gap-3 border border-dashed border-white/20 bg-[#111418] px-4 text-sm font-semibold normal-case tracking-normal text-neutral-400 transition hover:border-white/40">
              <Upload size={18} />Choose up to 8 images
              <input type="file" name="photos" accept="image/*" multiple className="sr-only" />
            </span>
          </label>
          {message && <p className="border border-white/10 bg-white/5 p-3 text-sm text-neutral-300 sm:col-span-2">{message}</p>}
          <button disabled={busy} className="flex min-h-12 items-center justify-center gap-2 bg-[#ef4538] px-5 text-sm font-black text-white transition hover:bg-[#d9362b] disabled:opacity-60 sm:col-span-2">
            {busy ? "Sending…" : "Send my vehicle"}<ArrowRight size={15} />
          </button>
        </form>
      </div>
    </section>
  );
}

function SectionHeader({ kicker, title, text, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[.2em] text-[#ff655a]">{kicker}</p>
        <h2 className="mt-3 max-w-4xl text-[clamp(2.1rem,4vw,3.9rem)] font-black leading-[1] tracking-[-.055em]">{title}</h2>
        {text && <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-400">{text}</p>}
      </div>
      {children}
    </div>
  );
}

function TickerContent({ ariaHidden = false }) {
  const items = ["Live inventory", "Approximate locations", "Reserve before you drive", "Lower Mainland"];
  return (
    <div className="motion-ticker-group" aria-hidden={ariaHidden || undefined}>
      {items.map((item) => (
        <span key={item}>
          {item}
          <i aria-hidden="true" />
        </span>
      ))}
    </div>
  );
}

function Step({ number, title, text }) {
  return (
    <article className="border-b border-white/10 p-6 last:border-0 md:border-b-0 md:border-r md:p-8">
      <span className="text-[10px] font-black tracking-[.2em] text-[#ff655a]">{number}</span>
      <h3 className="mt-9 text-2xl font-black tracking-[-.04em]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-400">{text}</p>
    </article>
  );
}

function photographedForType(cars, matcher) {
  return cars.find((car) => matcher.test(`${car.body_type || ""} ${car.fuel_type || ""} ${(car.fuel_tags || []).join(" ")}`) && carImages(car).length)
    || cars.find((car) => carImages(car).length);
}

function heroImageSources(car) {
  const media = [...(car?.media || [])]
    .filter((item) => item.kind === "image")
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  const identity = `${carName(car || {})} ${car?.title || ""}`;
  const preferredOrder = /rolls[\s-]*royce.*ghost/i.test(identity)
    ? 19
    : /\bmercedes(?:[\s-]+benz)?\s+e63s\b/i.test(identity)
      ? 1
      : 0;
  const preferred = media.find((item) => Number(item.sort_order) === preferredOrder);
  return [...new Set([preferred?.source_url, ...carImages(car || {})].filter(Boolean))];
}

function HeroField({ label, ...props }) {
  return (
    <label className="border-b border-white/10 px-3 py-2 lg:border-b-0 lg:border-r">
      <span className="block text-[8px] font-black uppercase tracking-[.16em] text-neutral-500">{label}</span>
      <input {...props} className="mt-1 h-7 w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-neutral-600" />
    </label>
  );
}

function HeroSelect({ label, values = [], placeholder, pairs = false, ...props }) {
  return (
    <label className="border-b border-white/10 px-3 py-2 lg:border-b-0 lg:border-r">
      <span className="block text-[8px] font-black uppercase tracking-[.16em] text-neutral-500">{label}</span>
      <select {...props} className="mt-1 h-7 w-full bg-transparent text-sm font-semibold text-white outline-none">
        <option value="" className="bg-[#111418]">{placeholder}</option>
        {values.filter(Boolean).map((item) => {
          const [value, text] = pairs ? item : [item, item];
          return <option key={value} value={value} className="bg-[#111418]">{text}</option>;
        })}
      </select>
    </label>
  );
}

function FilterInput({ label, name, value, placeholder }) {
  return (
    <label className="text-[9px] font-black uppercase tracking-[.14em] text-neutral-500">
      {label}
      <span className="relative mt-2 block">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input name={name} defaultValue={value || ""} placeholder={placeholder} className="h-11 w-full border border-white/10 bg-[#08090b] pl-9 pr-3 text-base font-normal normal-case tracking-normal text-white outline-none placeholder:text-neutral-600 focus:border-neutral-500" />
      </span>
    </label>
  );
}

function FilterSelect({ label, name, values = [], value, placeholder, pairs = false }) {
  return (
    <label className="text-[9px] font-black uppercase tracking-[.14em] text-neutral-500">
      {label}
      <select name={name} defaultValue={value || ""} className="mt-2 h-11 w-full border border-white/10 bg-[#08090b] px-3 text-base font-semibold normal-case tracking-normal text-white outline-none focus:border-neutral-500">
        <option value="">{placeholder}</option>
        {values.filter(Boolean).map((item) => {
          const [optionValue, optionLabel] = pairs ? item : [item, item];
          return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
        })}
      </select>
    </label>
  );
}

function SellerField({ label, wide = false, ...props }) {
  return (
    <label className={`text-[10px] font-black uppercase tracking-[.13em] text-neutral-500 ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      <input {...props} required className="mt-2 h-12 w-full border border-white/15 bg-[#111418] px-3 text-base font-normal normal-case tracking-normal text-white outline-none placeholder:text-neutral-600 focus:border-[#ef4538]" />
    </label>
  );
}

function ErrorMessage({ text }) {
  return <p className="mt-7 border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">{text}</p>;
}

function InventorySkeleton({ columns = 3 }) {
  return (
    <div className={`mt-8 grid gap-5 sm:grid-cols-2 ${columns === 4 ? "lg:grid-cols-4" : "xl:grid-cols-3"}`} aria-label="Loading inventory">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
        <div key={item} className="overflow-hidden border border-white/10 bg-[#111418]">
          <div className="aspect-[4/3] animate-pulse bg-neutral-900" />
          <div className="space-y-3 p-5"><div className="h-3 w-28 animate-pulse bg-neutral-800" /><div className="h-6 w-4/5 animate-pulse bg-neutral-800" /><div className="h-10 animate-pulse bg-neutral-900" /></div>
        </div>
      ))}
    </div>
  );
}
