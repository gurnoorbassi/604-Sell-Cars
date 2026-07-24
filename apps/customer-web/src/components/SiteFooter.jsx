import React from "react";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { LANDING_URL, WEBSITE_URL } from "../lib/links";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#060708] text-neutral-400">
      <div className="mx-auto grid w-[min(1320px,92vw)] gap-10 py-12 md:grid-cols-[1.4fr_.7fr_.9fr] md:py-14">
        <div>
          <a href={WEBSITE_URL} className="inline-flex items-center gap-3 text-white">
            <span className="grid h-10 w-[50px] place-items-center bg-[#ef3f32] text-sm font-black italic">604</span>
            <span><strong className="block text-base font-black tracking-[-.04em]">SELL CARS</strong><small className="mt-1 block text-[7px] font-bold uppercase tracking-[.22em] text-neutral-500">Dealer network</small></span>
          </a>
          <p className="mt-5 max-w-md text-sm leading-6">Browse available vehicles across independent Metro Vancouver dealerships and book each one at its real physical location.</p>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-white">Explore</p>
          <div className="mt-4 grid gap-3 text-sm">
            <a href={`${WEBSITE_URL}/inventory`} className="transition hover:text-white">Browse inventory</a>
            <a href={LANDING_URL} className="transition hover:text-white">Book a viewing</a>
            <a href={`${WEBSITE_URL}/#how-it-works`} className="transition hover:text-white">How it works</a>
          </div>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-white">Viewing information</p>
          <p className="mt-4 flex items-start gap-2 text-sm leading-6"><CalendarDays size={15} className="mt-1 shrink-0 text-[#ef3f32]" />Hourly appointments from 10 AM to 7 PM.</p>
          <p className="mt-3 flex items-start gap-2 text-sm leading-6"><MapPin size={15} className="mt-1 shrink-0 text-[#ef3f32]" />The selected vehicle determines the dealership and address.</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex w-[min(1320px,92vw)] flex-wrap items-center justify-between gap-3 py-5 text-[10px]">
          <span>© {new Date().getFullYear()} 604 Sell Cars</span>
          <a href={`${WEBSITE_URL}/inventory`} className="flex items-center gap-1.5 font-bold text-white">View live inventory <ArrowUpRight size={12} /></a>
        </div>
      </div>
    </footer>
  );
}
