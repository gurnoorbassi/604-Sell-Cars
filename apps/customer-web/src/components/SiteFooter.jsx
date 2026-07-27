import React from "react";
import { ArrowUpRight, CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { LANDING_URL, WEBSITE_URL } from "../lib/links";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#050607] text-neutral-400">
      <div className="mx-auto grid w-[min(1340px,92vw)] gap-10 py-12 md:grid-cols-[1.35fr_.7fr_1fr] md:py-16">
        <div>
          <a href={WEBSITE_URL} className="inline-flex items-center gap-3 text-white">
            <span className="grid h-10 w-[52px] place-items-center bg-[#ef4538] text-sm font-black italic">604</span>
            <span><strong className="block text-base font-black tracking-[-.04em]">SELL CARS</strong><small className="mt-1 block text-[7px] font-bold uppercase tracking-[.22em] text-neutral-500">Vehicle marketplace</small></span>
          </a>
          <p className="mt-5 max-w-md text-sm leading-6">
            Search live vehicles, see the approximate area, and let our team confirm the car before you make the drive.
          </p>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-white">Explore</p>
          <div className="mt-4 grid gap-3 text-sm">
            <a href={`${WEBSITE_URL}/inventory`} className="transition hover:text-white">Browse inventory</a>
            <a href={LANDING_URL} className="transition hover:text-white">Book a viewing</a>
            <a href={`${WEBSITE_URL}/#list-with-us`} className="transition hover:text-white">List your vehicle</a>
          </div>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-white">How viewings work</p>
          <p className="mt-4 flex items-start gap-2 text-sm leading-6"><CalendarDays size={15} className="mt-1 shrink-0 text-[#ef4538]" />Request a preferred time at least 24 hours ahead.</p>
          <p className="mt-3 flex items-start gap-2 text-sm leading-6"><ShieldCheck size={15} className="mt-1 shrink-0 text-[#ef4538]" />Our team confirms availability before the handoff.</p>
          <p className="mt-3 flex items-start gap-2 text-sm leading-6"><MapPin size={15} className="mt-1 shrink-0 text-[#ef4538]" />Public listings show only the approximate area.</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex w-[min(1340px,92vw)] flex-wrap items-center justify-between gap-3 py-5 text-[10px]">
          <span>© {new Date().getFullYear()} 604 Sell Cars</span>
          <a href={`${WEBSITE_URL}/inventory`} className="flex items-center gap-1.5 font-bold text-white">View live inventory <ArrowUpRight size={12} /></a>
        </div>
      </div>
    </footer>
  );
}
