"""
Search Telegram for ADLaM/Pulaar groups using your existing session.
Prints group usernames, member counts, and invite links.

Run: python find_groups.py
"""

import asyncio
import os

from telethon import TelegramClient
from telethon.tl.functions.contacts import SearchRequest
from telethon.tl.functions.channels import GetFullChannelRequest

API_ID   = int(os.environ.get("TELEGRAM_API_ID",  ""))
API_HASH = os.environ.get("TELEGRAM_API_HASH", "")

SEARCH_TERMS = [
    "adlam",
    "pulaar",
    "fulfulde",
    "fulani",
    "peul",
    "𞤢𞤣𞤤𞤢𞤥",   # "adlam" in ADLaM script
    "𞤆𞤵𞤤𞤢𞤪",   # "Pulaar" in ADLaM script
]

async def main():
    client = TelegramClient("gando_scraper", API_ID, API_HASH)
    await client.start()
    print("✓ Connected. Searching...\n")

    seen = set()

    for term in SEARCH_TERMS:
        try:
            result = await client(SearchRequest(q=term, limit=50))
            for chat in result.chats:
                if chat.id in seen:
                    continue
                seen.add(chat.id)

                username   = getattr(chat, "username", None)
                title      = getattr(chat, "title", "?")
                members    = getattr(chat, "participants_count", "?")
                username_str = f"@{username}" if username else "(no username / private)"

                print(f"  {title}")
                print(f"    username : {username_str}")
                print(f"    members  : {members}")
                print()
        except Exception as e:
            print(f"  [search '{term}' failed: {e}]")

    await client.disconnect()
    print(f"Done. Found {len(seen)} unique groups/channels.")

asyncio.run(main())
