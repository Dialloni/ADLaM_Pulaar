#!/bin/bash
# Gando AI — Daily ADLaM Corpus Sync
# Scrapes new messages from Telegram groups + uploads to Firestore
# Run manually: bash sync.sh

set -e

SCRAPER_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$SCRAPER_DIR/sync.log"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$LOG_FILE"
echo "$(date '+%Y-%m-%d %H:%M:%S') — Sync started" >> "$LOG_FILE"

cd "$SCRAPER_DIR"

# ── TELEGRAM NOTIFY HELPER ────────────────────────────────────────────────────
notify() {
  if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d chat_id="$TELEGRAM_CHAT_ID" \
      -d text="$1" \
      -d parse_mode="HTML" > /dev/null 2>&1 || true
  fi
}

# ── REQUIRED ENV VARS ─────────────────────────────────────────────────────────
if [ -z "$TELEGRAM_API_ID" ] || [ -z "$TELEGRAM_API_HASH" ]; then
  echo "ERROR: TELEGRAM_API_ID or TELEGRAM_API_HASH not set" >> "$LOG_FILE"
  notify "❌ <b>Gando Sync FAILED</b>&#10;Missing TELEGRAM_API_ID or TELEGRAM_API_HASH"
  exit 1
fi

if [ -z "$FIREBASE_SERVICE_ACCOUNT_KEY" ]; then
  echo "ERROR: FIREBASE_SERVICE_ACCOUNT_KEY not set" >> "$LOG_FILE"
  notify "❌ <b>Gando Sync FAILED</b>&#10;Missing FIREBASE_SERVICE_ACCOUNT_KEY"
  exit 1
fi

DB_ID="${FIRESTORE_DB_ID:-ai-studio-7ad94b26-04fc-4e1e-8215-809796583202}"

notify "🔄 <b>Gando Sync started</b>&#10;$(date '+%Y-%m-%d %H:%M')"

# ── SCRAPE TELEGRAM ───────────────────────────────────────────────────────────
echo "Scraping Telegram groups…" >> "$LOG_FILE"
python scrape.py >> "$LOG_FILE" 2>&1

# ── SCRAPE WEB ────────────────────────────────────────────────────────────────
echo "Scraping web sources…" >> "$LOG_FILE"
python scrape_web.py >> "$LOG_FILE" 2>&1

# ── CLEAN ─────────────────────────────────────────────────────────────────────
echo "Cleaning corpus…" >> "$LOG_FILE"
python clean_corpus.py >> "$LOG_FILE" 2>&1

# ── MERGE ─────────────────────────────────────────────────────────────────────
echo "Merging…" >> "$LOG_FILE"
python merge.py >> "$LOG_FILE" 2>&1

# Get merged count
TOTAL=$(grep -o '[0-9]* records' "$LOG_FILE" | tail -1 | grep -o '[0-9]*' || echo "?")

# ── UPLOAD ────────────────────────────────────────────────────────────────────
echo "Uploading to Firestore…" >> "$LOG_FILE"
UPLOAD_OUT=$(python upload_to_firestore.py \
  --db "$DB_ID" \
  --collection corpus_submissions \
  --file output/corpus_clean.jsonl 2>&1)
echo "$UPLOAD_OUT" >> "$LOG_FILE"

# Parse new uploads count
NEW=$(echo "$UPLOAD_OUT" | grep -o '[0-9]* new records' | grep -o '[0-9]*' || echo "0")

echo "$(date '+%Y-%m-%d %H:%M:%S') — Sync done" >> "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$LOG_FILE"

# ── FINAL NOTIFICATION ────────────────────────────────────────────────────────
if [ "$NEW" = "0" ] || [ -z "$NEW" ]; then
  notify "✅ <b>Gando Sync done</b>&#10;📊 No new messages since last run&#10;🗓 $(date '+%Y-%m-%d %H:%M')"
else
  notify "✅ <b>Gando Sync done</b>&#10;🆕 <b>${NEW} new messages</b> added to corpus&#10;📚 Total corpus: ${TOTAL} records&#10;🗓 $(date '+%Y-%m-%d %H:%M')"
fi
