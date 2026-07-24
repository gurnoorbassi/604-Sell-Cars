import React from "react";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { ADMIN_URL, BOARD_URL, LANDING_URL, WEBSITE_URL } from "../lib/links";

export default function SiteHeader({ admin = false }) {
  const siteHome = admin ? ADMIN_URL : WEBSITE_URL;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090a0c]/95 text-white backdrop-blur-xl">
      <div className="hidden border-b border-white/10 bg-black/40 md:block">
        <div className="mx-auto flex h-9 w-[min(1380px,94vw)] items-center justify-between text-[10px] font-bold uppercase tracking-[.17em] text-neutral-400">
          <span className="flex items-center gap-2">
            <MapPin size={12} className="text-[#ef3f32]" />
            Independent dealership inventory across Metro Vancouver
          </span>
          <span>{admin ? "Secure operations portal" : "Viewing appointments · Daily 10 AM–7 PM"}</span>
        </div>
      </div>

      <div className="mx-auto flex h-[74px] w-[min(1380px,94vw)] items-center justify-between gap-5">
        <a href={siteHome} className="group flex items-center gap-3" aria-label="604 Sell Cars home">
          <span className="relative grid h-11 w-[54px] place-items-center overflow-hidden bg-[#ef3f32] text-[17px] font-black italic tracking-[-.06em] text-white">
            <span className="absolute -right-2 top-0 h-full w-3 skew-x-[-12deg] bg-white/15" />
            604
          </span>
          <span className="leading-none">
            <strong className="block text-[17px] font-black tracking-[-.055em]">SELL CARS</strong>
            <small className="mt-1.5 block text-[8px] font-bold uppercase tracking-[.24em] text-neutral-500">
              {admin ? "Operations" : "Metro Vancouver"}
            </small>
          </span>
        </a>

        <nav className="flex items-center gap-1 text-[13px] font-bold" aria-label="Primary navigation">
          {admin ? (
            <>
              <a href={ADMIN_URL} className="rounded px-3 py-2 hover:bg-white/10">Lead desk</a>
              <a href={BOARD_URL} className="rounded px-3 py-2 hover:bg-white/10">Inventory board</a>
              <a href={WEBSITE_URL} className="hidden items-center gap-1 rounded px-3 py-2 text-neutral-400 hover:bg-white/10 lg:flex">
                Public site <ArrowUpRight size={14} />
              </a>
            </>
          ) : (
            <>
              <a href={WEBSITE_URL} className="hidden rounded px-3 py-2 text-neutral-300 hover:text-white sm:block">Home</a>
              <a href={`${WEBSITE_URL}/inventory`} className="rounded px-3 py-2 text-neutral-300 hover:text-white">Inventory</a>
              <a href={`${WEBSITE_URL}/#how-it-works`} className="hidden rounded px-3 py-2 text-neutral-300 hover:text-white lg:block">How it works</a>
              <a href={LANDING_URL} className="ml-1 flex items-center gap-2 bg-[#ef3f32] px-3.5 py-3 text-white transition hover:bg-[#d92d22] sm:px-5">
                <CalendarDays size={16} />
                <span className="hidden sm:inline">Book a viewing</span>
                <span className="sm:hidden">Book</span>
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
