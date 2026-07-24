import React from "react";
import BookingForm from "../components/BookingForm";
import SiteHeader from "../components/SiteHeader";

export default function LandingPage() {
  const initialCarId = new URLSearchParams(window.location.search).get("car") || "";
  return (
    <div className="min-h-screen bg-neutral-100">
      <SiteHeader />
      <main>
        <section className="bg-neutral-950 px-[4vw] pb-28 pt-14 text-white sm:pt-20">
          <div className="mx-auto w-[min(1180px,100%)]">
            <p className="text-xs font-black uppercase tracking-[.25em] text-red-500">Your next car is waiting</p>
            <h1 className="mt-5 max-w-5xl text-5xl font-black leading-[.92] tracking-[-.06em] sm:text-7xl lg:text-8xl">
              Pick the car.<br /><span className="text-neutral-500">Choose your time.</span>
            </h1>
            <p className="mt-7 max-w-xl text-neutral-300">Book your own viewing in under two minutes. The correct dealership location is set automatically from the vehicle you choose.</p>
          </div>
        </section>
        <div className="mx-auto -mt-16 w-[min(900px,92vw)] pb-20">
          <BookingForm initialCarId={initialCarId} />
        </div>
      </main>
    </div>
  );
}
