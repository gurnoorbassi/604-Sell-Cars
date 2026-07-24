import React from "react";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { ADMIN_URL, BOARD_URL, LANDING_URL, WEBSITE_URL } from "../lib/links";

export default function SiteHeader({ admin = false }) {
  const siteHome = admin ? ADMIN_URL : WEBSITE_URL;
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08090b]/96 text-white backdrop-blur-xl">
      <div className="hidden border-b border-white/10 md:block">
        <div className="mx-auto flex h-8 w-[min(1320px,92vw)] items-center justify-between text-[9px] font-bold uppercase tracking-[.16em] text-neutral-500">
          <span className="flex items-center gap-2"><MapPin size={11} className="text-[#ef3f32]" />Metro Vancouver dealership inventory</span>
          <span>{admin ? "Secure operations portal" : "Viewings available daily · 10 AM–7 PM"}</span>
        </div>
      </div>
      <div className="mx-auto flex h-[72px] w-[min(1320px,92vw)] items-center justify-between gap-5">
        <a href={siteHome} className="flex items-center gap-3" aria-label="604 Sell Cars home">
          <span className="grid h-10 w-[50px] place-items-center bg-[#ef3f32] text-[15px] font-black italic tracking-[-.06em] text-white">604</span>
          <span>
            <strong className="block text-[15px] font-black leading-none tracking-[-.045em]">SELL CARS</strong>
            <small className="mt-1.5 block text-[7px] font-bold uppercase tracking-[.23em] text-neutral-500">{admin ? "Operations" : "Dealer network"}</small>
          </span>
        </a>

        <nav className="flex items-center gap-1 text-xs font-bold" aria-label="Primary navigation">
          {admin ? (
            <>
              <a href={ADMIN_URL} className="px-3 py-2 hover:bg-white/5">Lead desk</a>
              <a href={BOARD_URL} className="px-3 py-2 hover:bg-white/5">Inventory board</a>
              <a href={WEBSITE_URL} className="hidden items-center gap-1 px-3 py-2 text-neutral-400 hover:text-white lg:flex">Public site <ArrowUpRight size={13} /></a>
            </>
          ) : (
            <>
              <a href={WEBSITE_URL} className="hidden px-3 py-2 text-neutral-400 transition hover:text-white md:block">Home</a>
              <a href={`${WEBSITE_URL}/inventory`} className="px-3 py-2 text-neutral-300 transition hover:text-white">Inventory</a>
              <a href={`${WEBSITE_URL}/#how-it-works`} className="hidden px-3 py-2 text-neutral-400 transition hover:text-white lg:block">How it works</a>
              <a href={LANDING_URL} className="ml-2 flex h-10 items-center gap-2 bg-[#ef3f32] px-4 text-white transition hover:bg-[#d92d22] sm:px-5">
                <CalendarDays size={15} /><span className="hidden sm:inline">Book a viewing</span><span className="sm:hidden">Book</span>
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
