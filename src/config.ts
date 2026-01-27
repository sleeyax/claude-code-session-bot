import "dotenv/config";

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
export const ALLOWED_USER_IDS = (process.env.TELEGRAM_ALLOWED_USER_IDS ?? "")
  .split(",")
  .map((id) => parseInt(id.trim(), 10))
  .filter((id) => !isNaN(id));
export const TIMEZONE = process.env.TIMEZONE ?? "UTC";
export const SESSION_DURATION_MS = 5 * 60 * 60 * 1000; // 5 hours
export const DB_PATH = process.env.DB_PATH ?? "data/bot.db";

if (!TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

if (ALLOWED_USER_IDS.length === 0) {
  console.error("TELEGRAM_ALLOWED_USER_IDS is required");
  process.exit(1);
}
