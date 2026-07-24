import React, { lazy, Suspense } from "react";

const AdminPage = lazy(() => import("./pages/AdminPage"));
const CarDetailPage = lazy(() => import("./pages/CarDetailPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const PublicSite = lazy(() => import("./pages/PublicSite"));

function LoadingSurface() {
  return <div className="grid min-h-screen place-items-center bg-[#111216] text-sm font-bold text-neutral-400">Loading 604 Sell Cars…</div>;
}

export default function App() {
  const hostname = window.location.hostname;
  const surface = hostname.includes("604-sell-cars-booking")
    ? "landing"
    : hostname.includes("604-sell-cars-leads")
      ? "admin"
      : hostname.includes("604-sell-cars-website")
        ? "site"
        : import.meta.env.VITE_SURFACE || "site";
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  let content;
  if (surface === "landing") content = <LandingPage />;
  else if (surface === "admin") content = <AdminPage />;
  else {
    const carMatch = path.match(/^\/cars\/([^/]+)$/);
    content = carMatch
      ? <CarDetailPage id={decodeURIComponent(carMatch[1])} />
      : <PublicSite />;
  }

  return <Suspense fallback={<LoadingSurface />}>{content}</Suspense>;
}
