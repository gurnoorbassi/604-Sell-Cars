import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

const AdminPage = React.lazy(() => import("./pages/AdminPage"));
const CarDetailPage = React.lazy(() => import("./pages/CarDetailPage"));
const LandingPage = React.lazy(() => import("./pages/LandingPage"));
const PublicSite = React.lazy(() => import("./pages/PublicSite"));

function Router() {
  const { pathname } = window.location;
  if (pathname === "/") {
    window.location.replace("/site");
    return null;
  }
  if (pathname === "/landing") return <LandingPage />;
  if (pathname === "/admin") return <AdminPage />;
  if (pathname === "/board") {
    window.location.replace("/admin?view=inventory");
    return null;
  }
  if (pathname.startsWith("/site/cars/")) {
    return <CarDetailPage id={decodeURIComponent(pathname.split("/").pop())} />;
  }
  if (pathname === "/site" || pathname === "/site/inventory") return <PublicSite />;
  return <PublicSite />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <React.Suspense fallback={<div className="grid min-h-screen place-items-center bg-neutral-950 text-neutral-400">Loading 604 Sell Cars…</div>}>
      <Router />
    </React.Suspense>
  </React.StrictMode>,
);
