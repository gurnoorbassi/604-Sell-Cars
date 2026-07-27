import React, { useEffect } from "react";
import { CheckCircle2, Clock3, MapPin, ShieldCheck } from "lucide-react";
import BookingForm from "../components/BookingForm";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import { setPageMeta } from "../lib/pageMeta";

export default function LandingPage() {
  const initialCarId = new URLSearchParams(window.location.search).get("car") || "";
  useEffect(() => {
    setPageMeta({
      title: "Book a Vehicle Viewing | 604 Sell Cars",
      description: "Choose a live vehicle and request a viewing time with the 604 Sell Cars team.",
      robots: "noindex,nofollow",
    });
  }, []);
  return (
    <div className="min-h-screen bg-[#08090b]">
      <SiteHeader />
      <main className="relative isolate overflow-hidden bg-[#08090b] text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,rgba(239,69,56,.12),transparent_32%),linear-gradient(120deg,#08090b_0%,#111419_100%)]" />
        <div className="mx-auto grid min-h-[calc(100vh-76px)] w-[min(1360px,94vw)] min-w-0 gap-8 py-6 sm:py-10 lg:grid-cols-[.72fr_1.28fr] lg:items-start lg:gap-14 lg:py-16">
          <section className="max-w-xl lg:sticky lg:top-28">
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#ff655a]">Viewing request</p>
            <h1 className="mt-4 max-w-lg text-[clamp(2.25rem,5vw,4.5rem)] font-black leading-[.96] tracking-[-.06em]">
              We check the car before you make the drive.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-neutral-300">
              Pick a live vehicle and a time that works. Our team confirms availability and arranges the handoff.
            </p>
            <div className="mt-8 hidden space-y-5 lg:block">
              <Benefit icon={Clock3} title="24-hour confirmation window" text="Your request gives our team time to verify the vehicle." />
              <Benefit icon={MapPin} title="Approximate area first" text="Exact handoff details are shared only after confirmation." />
              <Benefit icon={ShieldCheck} title="No sensitive credit data" text="We only ask for a self-selected range—never a SIN or documents." />
            </div>
            <div className="mt-8 hidden items-center gap-3 border-t border-white/10 pt-6 text-sm text-neutral-500 lg:flex">
              <CheckCircle2 size={18} className="text-emerald-400" />
              No account required · Request takes about three minutes
            </div>
          </section>
          <section className="min-w-0 max-w-full">
            <BookingForm initialCarId={initialCarId} />
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Benefit({ icon: Icon, title, text }) {
  return (
    <div className="flex gap-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center border border-[#ef4538]/35 bg-[#ef4538]/10 text-[#ff655a]"><Icon size={19} /></span>
      <div><strong className="block">{title}</strong><p className="mt-1 text-sm leading-6 text-neutral-500">{text}</p></div>
    </div>
  );
}
