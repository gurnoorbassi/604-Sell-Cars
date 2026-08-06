import React, { useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, Menu, X } from "lucide-react";
import { ADMIN_URL, BOARD_URL, PUBLIC_BOOKING_URL, WEBSITE_URL } from "../lib/links";

export default function SiteHeader({ admin = false }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const siteHome = admin ? ADMIN_URL : WEBSITE_URL;

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 72);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <header className={`site-header sticky top-0 z-50 border-b border-white/10 text-white backdrop-blur-xl ${scrolled ? "is-scrolled bg-[#090a0c]/98 shadow-[0_14px_35px_rgba(0,0,0,.24)]" : "bg-[#090a0c]/94"}`}>
      <div className="mx-auto flex h-[82px] w-[min(1440px,92vw)] items-center justify-between gap-5 transition-all duration-300">
        <a href={siteHome} className="flex items-center gap-3" aria-label="604 Sell Cars home">
          <span className="grid h-11 w-[58px] place-items-center bg-[#f2473d] text-[15px] font-black italic tracking-[-.06em] text-white">604</span>
          <span>
            <strong className="block text-[15px] font-black leading-none tracking-[-.045em]">SELLSCARS</strong>
            <small className="mt-1.5 block text-[7px] font-bold uppercase tracking-[.25em] text-neutral-500">{admin ? "Operations desk" : "Lower Mainland marketplace"}</small>
          </span>
        </a>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="grid h-11 w-11 place-items-center border border-white/15 md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={open}
          aria-controls="primary-navigation"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>

        <nav id="primary-navigation" className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-[82px] flex-col border-b border-white/10 bg-[#090a0c] p-4 text-sm font-bold md:static md:flex md:flex-row md:items-center md:border-0 md:bg-transparent md:p-0`} aria-label="Primary navigation">
          {admin ? (
            <>
              <a href={ADMIN_URL} className="px-4 py-3 hover:bg-white/5">Lead desk</a>
              <a href={BOARD_URL} className="px-4 py-3 hover:bg-white/5">Inventory board</a>
              <a href={WEBSITE_URL} className="flex items-center gap-1 px-4 py-3 text-neutral-400 hover:text-white">Public site <ArrowUpRight size={13} /></a>
            </>
          ) : (
            <>
              <a href={WEBSITE_URL} className="px-4 py-3 text-neutral-300 transition hover:text-white">Home</a>
              <a href={`${WEBSITE_URL}/inventory`} className="px-4 py-3 text-neutral-300 transition hover:text-white">Inventory</a>
              <a href={`${WEBSITE_URL}/#how-it-works`} className="px-4 py-3 text-neutral-300 transition hover:text-white">How it works</a>
              <a href={`${WEBSITE_URL}/#list-with-us`} className="px-4 py-3 text-neutral-300 transition hover:text-white">Sell your vehicle</a>
              <a href={PUBLIC_BOOKING_URL} className="mt-2 flex min-h-11 items-center justify-center gap-2 border border-[#f2473d] bg-[#f2473d] px-5 text-white transition hover:bg-[#d9362b] md:ml-2 md:mt-0">
                <CalendarDays size={15} />Book a test drive
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
