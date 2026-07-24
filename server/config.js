import "dotenv/config";

export const config = {
  databaseUrl: process.env.DATABASE_URL || "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
  adminNotifyNumber: process.env.ADMIN_NOTIFY_NUMBER || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",
  metaPixelId: process.env.META_PIXEL_ID || "",
  port: Number(process.env.PORT || 3000),
  timezone: process.env.APP_TIMEZONE || "America/Vancouver",
  nodeEnv: process.env.NODE_ENV || "development",
  uploadDir: process.env.UPLOAD_DIR || "uploads",
};

export function validateConfig() {
  const missing = ["databaseUrl", "adminPassword"].filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.map((key) =>
      key === "databaseUrl" ? "DATABASE_URL" : "ADMIN_PASSWORD").join(", ")}`);
  }
}
