// Fire-and-forget operational alert to Telegram (spend ceiling, abuse, etc).
// Reuses the SAME bot + chat as the harvester (scraper/bot.py) — set
// TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID on this service and alerts land in the
// same chat that already gets "Harvest done" messages. The TELEGRAM_ALERT_*
// names override, if you ever want a separate alert channel.
// If unconfigured it logs and returns — an alert path must NEVER throw into a
// user request. (Railway stores env values with literal quotes — strip them.)
export async function sendAlert(text: string): Promise<void> {
  const token = (process.env.TELEGRAM_ALERT_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').replace(/['"]/g, '');
  const chatId = (process.env.TELEGRAM_ALERT_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '').replace(/['"]/g, '');
  if (!token || !chatId) {
    console.warn('[alert] TELEGRAM_ALERT_* not set — skipping alert:', text);
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
  } catch (e) {
    console.error('[alert] send failed:', e);
  }
}
