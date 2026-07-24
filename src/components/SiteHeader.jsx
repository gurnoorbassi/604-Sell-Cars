import React from "react";

export default function SiteHeader({ admin = false }) {
  return (
    <header className="border-b border-white/10 bg-neutral-950 text-white">
      <div className="mx-auto flex min-h-16 w-[min(1180px,92vw)] items-center justify-between gap-4">
        <a href={admin ? "/admin" : "/site"} className="flex items-center gap-2 font-black tracking-tight">
          <span className="grid h-10 w-12 -skew-x-6 place-items-center bg-red-600 text-sm">604</span>
          <span>SELL CARS</span>
        </a>
        <nav className="flex items-center gap-4 text-sm text-neutral-300">
          {admin ? (
            <>
              <a href="/admin">Lead desk</a>
              <a href="/admin?view=inventory">Inventory</a>
              <a href="/site">Public site ↗</a>
            </>
          ) : (
            <>
              <a href="/site/inventory">Inventory</a>
              <a href="/landing" className="bg-red-600 px-3 py-2 font-bold text-white">Book a viewing</a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
