const local = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const fallback = (productionUrl) => local ? window.location.origin : productionUrl;

export const WEBSITE_URL = (import.meta.env.VITE_WEBSITE_URL || fallback("https://604-sell-cars-website.netlify.app")).replace(/\/$/, "");
export const LANDING_URL = (import.meta.env.VITE_LANDING_URL || fallback("https://604-sell-cars-booking.netlify.app")).replace(/\/$/, "");
export const ADMIN_URL = (import.meta.env.VITE_ADMIN_URL || fallback("https://604-sell-cars-leads.netlify.app")).replace(/\/$/, "");
export const BOARD_URL = (import.meta.env.VITE_BOARD_URL || "https://dealership-inventory-board.netlify.app").replace(/\/$/, "");
