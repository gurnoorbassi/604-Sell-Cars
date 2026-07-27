import React, { useEffect } from "react";
import { ArrowLeft, Search } from "lucide-react";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import { WEBSITE_URL } from "../lib/links";
import { setPageMeta } from "../lib/pageMeta";

export default function NotFoundPage() {
  useEffect(() => {
    setPageMeta({
      title: "Page Not Found | 604 Sell Cars",
      description: "That page is not available. Browse the live 604 Sell Cars inventory instead.",
      robots: "noindex,nofollow",
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#08090b] text-white">
      <SiteHeader />
      <main className="mx-auto grid min-h-[calc(100vh-160px)] w-[min(900px,92vw)] place-items-center py-20 text-center">
        <section>
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#ff655a]">404 · Page not found</p>
          <h1 className="mt-4 text-[clamp(2.6rem,7vw,5.4rem)] font-black leading-[.95] tracking-[-.06em]">
            This road doesn&apos;t lead anywhere.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-neutral-400">
            The link may be outdated, but the live inventory is ready to browse.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={`${WEBSITE_URL}/inventory`} className="inline-flex min-h-12 items-center gap-2 bg-[#ef4538] px-6 text-sm font-black">
              <Search size={16} /> Browse inventory
            </a>
            <a href={WEBSITE_URL} className="inline-flex min-h-12 items-center gap-2 border border-white/15 px-6 text-sm font-black">
              <ArrowLeft size={16} /> Back home
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
