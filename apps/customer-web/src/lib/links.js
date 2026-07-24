export const WEBSITE_URL = (import.meta.env.VITE_WEBSITE_URL || window.location.origin).replace(/\/$/, "");
export const LANDING_URL = (import.meta.env.VITE_LANDING_URL || window.location.origin).replace(/\/$/, "");
export const ADMIN_URL = (import.meta.env.VITE_ADMIN_URL || window.location.origin).replace(/\/$/, "");
export const BOARD_URL = (import.meta.env.VITE_BOARD_URL || "https://dealership-inventory-board.netlify.app").replace(/\/$/, "");
