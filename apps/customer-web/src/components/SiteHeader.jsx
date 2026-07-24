import React from "react";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { ADMIN_URL, BOARD_URL, LANDING_URL, WEBSITE_URL } from "../lib/links";

export default function SiteHeader({ admin = false }) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 text-neutral-950 shadow-[0_1px_0_rgba(0,0,0,.04)] backdrop-blur">
      <div className="hidden bg-neutral-950 text-neutral-300 sm:block">
        <div className="mx-auto flex h-8 w-[min(1240px,92vw)] items-center justify-between text-[11px] font-semibold uppercase tracking-[.12em]">
          <span className="flex items-center gap-2"><MapPin size={13} className="text-red-500" /> Metro Vancouver dealership inventory</span>
          <span>{admin ? "Secure operations portal" : "Viewings available daily · 10 AM–7 PM"}</span>
        </div>
      </div>
      <div className="mx-auto flex min-h-[72px] w-[min(1240px,92vw)] items-center justify-between gap-4">
        <a href={admin ? ADMIN_URL : WEBSITE_URL} className="group flex items-center gap-3" aria-label="604 Sell Cars home">
          <span className="grid h-11 w-12 place-items-center rounded-sm bg-red-600 text-sm font-black italic text-white shadow-[4px_4px_0_#171717] transition group-hover:-translate-y-0.5">604</span>
          <span className="leading-none">
            <strong className="block text-[17px] font-black tracking-[-.04em]">SELL CARS</strong>
            <small className="mt-1 block text-[9px] font-bold uppercase tracking-[.2em] text-neutral-500">{admin ? "Operations" : "Metro Vancouver"}</small>
          </span>
        </a>
        <nav className="flex items-center gap-1 text-sm font-bold sm:gap-3" aria-label="Primary navigation">
          {admin ? (
            <>
              <a href={ADMIN_URL} className="rounded-md px-3 py-2 hover:bg-neutral-100">Lead desk</a>
              <a href={BOARD_URL} className="rounded-md px-3 py-2 hover:bg-neutral-100">Inventory board</a>
              <a href={WEBSITE_URL} className="hidden items-center gap-1 rounded-md px-3 py-2 text-neutral-600 hover:bg-neutral-100 sm:flex">Public site <ArrowUpRight size={15} /></a>
            </>
          ) : (
            <>
              <a href={`${WEBSITE_URL}/inventory`} className="rounded-md px-3 py-2 hover:bg-neutral-100">Inventory</a>
              <a href={LANDING_URL} className="flex items-center gap-2 rounded-md bg-red-600 px-3 py-2.5 text-white shadow-sm transition hover:bg-red-700 sm:px-4">
                <CalendarDays size={16} /><span className="hidden sm:inline">Book a viewing</span><span className="sm:hidden">Book</span>
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
