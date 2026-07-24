import { createApp } from "./app.js";
import { config, validateConfig } from "./config.js";
import { pool } from "./db.js";
import { startReminderJob } from "./services/reminders.js";

validateConfig();
await pool.query("select 1");
const app = createApp();
const server = app.listen(config.port, () => console.log(`604 Sell Cars listening on port ${config.port}`));
const reminders = startReminderJob();

async function shutdown(signal) {
  console.log(`${signal} received, shutting down.`);
  reminders.stop();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
