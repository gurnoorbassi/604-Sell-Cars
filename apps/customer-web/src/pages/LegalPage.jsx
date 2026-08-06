import React, { useEffect } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import { PUBLIC_BOOKING_URL, WEBSITE_URL } from "../lib/links";
import { setPageMeta } from "../lib/pageMeta";

const pages = {
  about: {
    kicker: "About 604 Sell Cars",
    title: "A simpler way to find and view vehicles across the Lower Mainland.",
    description: "604 Sell Cars brings live listings from independent dealerships and private sellers into one searchable marketplace.",
    sections: [
      ["What we do", "We organize live vehicle listings in one place, show the approximate area, and help buyers request a confirmed viewing before making the drive."],
      ["How listings work", "Vehicle details come from the seller or dealership responsible for the listing. Our team confirms availability and handoff details when a viewing is requested."],
      ["Why locations are approximate", "Public listings protect dealership and private-seller information. The confirmed location is shared during the viewing process."],
    ],
  },
  privacy: {
    kicker: "Privacy Policy",
    title: "How submitted information is handled.",
    description: "This policy covers information submitted through the 604 Sell Cars website.",
    sections: [
      ["Information we collect", "When you request a viewing or submit a vehicle, we may collect your name, phone number, email address, vehicle details, preferred appointment information, notes, and uploaded photos."],
      ["How it is used", "We use submitted information to respond to your request, confirm availability, coordinate a viewing or listing review, prevent duplicate submissions, and operate the marketplace."],
      ["Service providers", "Information may be processed by the hosting, database, file-storage, and workflow providers used to operate 604 Sell Cars. We do not publish private-seller photos or contact information unless a listing is reviewed and approved."],
      ["Your choices", "You can ask about, correct, or request deletion of information you submitted by contacting the team through the same booking or seller-submission channel you used."],
    ],
  },
  terms: {
    kicker: "Website Terms",
    title: "Important information about listings and viewings.",
    description: "Using this website means you understand the following marketplace terms.",
    sections: [
      ["Listing accuracy", "Vehicle information, price, mileage, features, condition, taxes, fees, and availability must be confirmed before purchase. Listings may be corrected, changed, or removed without notice."],
      ["Marketplace role", "604 Sell Cars helps connect buyers with independent dealerships and private sellers. The seller responsible for a vehicle remains responsible for the sale, disclosures, paperwork, warranties, and legal compliance."],
      ["Viewings", "A request is not a guaranteed reservation. Do not travel until the team confirms the vehicle, time, and handoff location."],
      ["No purchase advice", "Website content is general listing information, not mechanical, legal, lending, insurance, or financial advice. Buyers should complete their own inspection and due diligence."],
    ],
  },
};

export default function LegalPage({ page }) {
  const content = pages[page] || pages.about;

  useEffect(() => {
    setPageMeta({
      title: `${content.kicker} | 604 Sell Cars`,
      description: content.description,
      canonical: `${WEBSITE_URL}/${page}`,
    });
  }, [content, page]);

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f5f5f3]">
      <SiteHeader />
      <main>
        <section className="border-b border-white/10 bg-[#0d0f12]">
          <div className="mx-auto w-[min(1050px,92vw)] py-14 sm:py-20">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ff655a]">{content.kicker}</p>
            <h1 className="mt-4 max-w-4xl text-[clamp(2.5rem,5vw,4.8rem)] font-black leading-[.98] tracking-[-.06em]">{content.title}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-400">{content.description}</p>
          </div>
        </section>
        <section className="mx-auto grid w-[min(1050px,92vw)] gap-5 py-12 sm:py-16">
          {content.sections.map(([title, text]) => (
            <article key={title} className="border border-white/10 bg-[#111418] p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <ShieldCheck className="mt-1 shrink-0 text-[#ef4538]" size={20} />
                <div><h2 className="text-xl font-black">{title}</h2><p className="mt-3 text-sm leading-7 text-neutral-400">{text}</p></div>
              </div>
            </article>
          ))}
          <div className="mt-3 flex flex-wrap gap-3">
            <a href={`${WEBSITE_URL}/inventory`} className="inline-flex min-h-12 items-center gap-2 bg-white px-6 text-sm font-black text-black">Browse inventory <ArrowRight size={15} /></a>
            <a href={PUBLIC_BOOKING_URL} className="inline-flex min-h-12 items-center gap-2 border border-white/20 px-6 text-sm font-black text-white">Request a viewing</a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
