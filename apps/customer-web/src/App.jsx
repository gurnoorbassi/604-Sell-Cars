import React from "react";
import AdminPage from "./pages/AdminPage";
import CarDetailPage from "./pages/CarDetailPage";
import LandingPage from "./pages/LandingPage";
import PublicSite from "./pages/PublicSite";

export default function App() {
  const surface = import.meta.env.VITE_SURFACE || "site";
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (surface === "landing") return <LandingPage />;
  if (surface === "admin") return <AdminPage />;

  const carMatch = path.match(/^\/cars\/([^/]+)$/);
  if (carMatch) return <CarDetailPage id={decodeURIComponent(carMatch[1])} />;
  return <PublicSite />;
}
