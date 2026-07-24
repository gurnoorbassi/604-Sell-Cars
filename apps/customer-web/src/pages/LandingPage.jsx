import React from "react";
import { CheckCircle2, Clock3, MapPin, ShieldCheck } from "lucide-react";
import BookingForm from "../components/BookingForm";
import SiteHeader from "../components/SiteHeader";

export default function LandingPage() {
  const initialCarId = new URLSearchParams(window.location.search).get("car") || "";
  return (
    <div className="min-h-screen bg-[#f5f4f1]">
      <SiteHeader />
      <main className="relative isolate overflow-hidden bg-neutral-950 text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(220,38,38,.22),transparent_34%),linear-gradient(110deg,#080808_0%,#171717_58%,#080808_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:70px_70px]" />
        <div className="mx-auto grid min-h-[calc(100vh-104px)] w-[min(1240px,92vw)] gap-10 py-12 lg:grid-cols-[.85fr_1.15fr] lg:items-center lg:py-16">
          <section className="max-w-xl">
            <p className="text-xs font-black uppercase tracking-[.22em] text-red-400">Book directly from live inventory</p>
            <h1 className="mt-5 text-[clamp(3rem,6vw,5.4rem)] font-black leading-[.9] tracking-[-.06em]">
              Your next viewing, booked in minutes.
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-neutral-300">
              Pick the vehicle you want, choose a real available time, and we’ll automatically send you to the dealership where the car is located.
            </p>
            <div className="mt-9 space-y-5">
              <Benefit icon={Clock3} title="Choose your own time" text="Hourly appointments from 10 AM to 7 PM." />
              <Benefit icon={MapPin} title="Correct dealership, every time" text="The vehicle determines the location automatically." />
              <Benefit icon={ShieldCheck} title="No duplicate bookings" text="Live availability prevents conflicting appointments." />
            </div>
            <div className="mt-10 flex items-center gap-3 border-t border-white/10 pt-7 text-sm text-neutral-400">
              <CheckCircle2 size={19} className="text-green-400" />
              <span>No account required · Confirmation appears instantly</span>
            </div>
          </section>
          <section className="lg:pl-6">
            <BookingForm initialCarId={initialCarId} />
          </section>
        </div>
      </main>
    </div>
  );
}

function Benefit({ icon: Icon, title, text }) {
  return (
    <div className="flex gap-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400"><Icon size={20} /></span>
      <div><strong className="block">{title}</strong><p className="mt-1 text-sm leading-6 text-neutral-400">{text}</p></div>
    </div>
  );
}
