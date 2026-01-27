import { TELEGRAM_BOT_TOKEN, ALLOWED_USER_IDS } from "./config";
import { initDb } from "./db";
import { createBot } from "./bot";
import { restoreSchedules, setScheduleCallback } from "./scheduler";

initDb();

const bot = createBot(TELEGRAM_BOT_TOKEN);

setScheduleCallback((schedule, success, error) => {
  const chatId = ALLOWED_USER_IDS[0];
  if (success) {
    bot.sendMessage(chatId, `Scheduled warmup fired (ID ${schedule.id}). Session started!`);
  } else {
    bot.sendMessage(chatId, `Scheduled warmup failed (ID ${schedule.id}): ${error}`);
  }
});

restoreSchedules();

console.log("Bot started");
