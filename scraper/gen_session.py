"""
Make a fresh Telegram USER session string for the harvester.

Run on your Mac (NOT Railway):
    pip3 install telethon
    python3 scraper/gen_session.py

It asks for:
  • API ID    (from Railway var TELEGRAM_API_ID)
  • API HASH  (from Railway var TELEGRAM_API_HASH)
  • your phone number  (e.g. +1718...)
  • the login code Telegram texts you

Then it prints a SESSION STRING. Paste that into:
    Railway -> scraper service -> Variables -> TELEGRAM_SESSION   (no quotes)

Keep it secret — it logs in as your Telegram account.
"""
from telethon.sync import TelegramClient
from telethon.sessions import StringSession

print("\n=== Generate Telegram user session ===\n")
api_id   = int(input("API ID (TELEGRAM_API_ID): ").strip())
api_hash = input("API HASH (TELEGRAM_API_HASH): ").strip()

with TelegramClient(StringSession(), api_id, api_hash) as client:
    print("\n========================================================")
    print("YOUR SESSION STRING (copy the whole line below):\n")
    print(client.session.save())
    print("\n========================================================")
    print("Paste into Railway -> scraper -> Variables -> TELEGRAM_SESSION")
    print("Then redeploy. Keep it secret.")
