import React from "react";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { LANDING_URL, WEBSITE_URL } from "../lib/links";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#090a0c] text-neutral-400">
      <div className="mx-auto grid w-[min(1380px,94vw)] gap-10 py-12 md:grid-cols-[1.2fr_.8fr_.8fr]">
        <div>
          <a href={WEBSITE_URL} className="inline-flex items-center gap-3 text-white">
            <span className="grid h-10 w-12 place-items-center bg-[#ef3f32] font-black italic">604</span>
            <strong className="text-lg font-black tracking-[-.04em]">SELL CARS</strong>
          </a>
          <p className="mt-5 max-w-sm text-sm leading-6">
            One place to browse live inventory from independent dealerships across Metro Vancouver and book the right vehicle at its real location.
          </p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-white">Explore</p>
          <div className="mt-4 grid gap-3 text-sm">
            <a href={`${WEBSITE_URL}/inventory`} className="hover:text-white">Browse inventory</a>
            <a href={LANDING_URL} className="hover:text-white">Book a viewing</a>
            <a href={`${WEBSITE_URL}/#how-it-works`} className="hover:text-white">How it works</a>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-white">Viewing appointments</p>
          <p className="mt-4 flex items-start gap-2 text-sm leading-6"><CalendarDays size={16} className="mt-1 text-[#ef3f32]" />Daily, 10 AM–7 PM</p>
          <p className="mt-3 flex items-start gap-2 text-sm leading-6"><MapPin size={16} className="mt-1 text-[#ef3f32]" />The vehicle determines the dealership location.</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex w-[min(1380px,94vw)] flex-wrap items-center justify-between gap-3 py-5 text-[11px]">
          <span>© {new Date().getFullYear()} 604 Sell Cars</span>
          <a href={`${WEBSITE_URL}/inventory`} className="flex items-center gap-1 font-bold text-white">Shop live inventory <ArrowUpRight size={13} /></a>
        </div>
      </div>
    </footer>
  );
}
