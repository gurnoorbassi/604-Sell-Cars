import React from "react";
import { CheckCircle2, Clock3, MapPin, ShieldCheck } from "lucide-react";
import BookingForm from "../components/BookingForm";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export default function LandingPage() {
  const initialCarId = new URLSearchParams(window.location.search).get("car") || "";
  return (
    <div className="min-h-screen bg-[#f3f3f1]">
      <SiteHeader />
      <main className="relative isolate overflow-hidden bg-[#111216] text-white">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(115deg,#111216_0%,#111216_55%,#1d2025_100%)]" />
        <div className="absolute left-0 top-0 -z-10 h-full w-1 bg-[#ef3f32]" />
        <div className="mx-auto grid min-h-[calc(100vh-113px)] w-[min(1380px,94vw)] gap-12 py-12 lg:grid-cols-[.78fr_1.22fr] lg:items-center lg:py-16">
          <section className="max-w-xl">
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#ff6b60]">Book directly from live inventory</p>
            <h1 className="mt-5 text-[clamp(2.8rem,5vw,4.7rem)] font-black leading-[.95] tracking-[-.06em]">
              See the right car at the right location.
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-neutral-300">
              Choose a live vehicle and an available time. Its dealership and full address are handled automatically.
            </p>
            <div className="mt-9 space-y-5">
              <Benefit icon={Clock3} title="Choose your own time" text="Hourly appointments from 10 AM to 7 PM." />
              <Benefit icon={MapPin} title="Correct dealership, every time" text="The vehicle determines the physical location automatically." />
              <Benefit icon={ShieldCheck} title="No duplicate bookings" text="Live availability prevents conflicting appointments at the same lot." />
            </div>
            <div className="mt-10 flex items-center gap-3 border-t border-white/15 pt-7 text-sm text-neutral-400">
              <CheckCircle2 size={19} className="text-green-400" />
              <span>No account required · Confirmation appears instantly</span>
            </div>
          </section>
          <section className="lg:pl-6">
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
      <span className="grid h-11 w-11 shrink-0 place-items-center border border-[#ef3f32]/40 bg-[#ef3f32]/10 text-[#ff6b60]"><Icon size={20} /></span>
      <div><strong className="block">{title}</strong><p className="mt-1 text-sm leading-6 text-neutral-400">{text}</p></div>
    </div>
  );
}
