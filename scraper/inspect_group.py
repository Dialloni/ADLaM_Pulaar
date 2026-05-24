"""
Inspect a single group with a lower ADLaM ratio threshold.
Usage: python inspect_group.py <group> <min_ratio>
Example: python inspect_group.py adlampular 0.3
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from telethon import TelegramClient
from telethon.tl.types import Message

API_ID   = int(os.environ.get("TELEGRAM_API_ID", ""))
API_HASH = os.environ.get("TELEGRAM_API_HASH", "")
SESSION_FILE = "gando_scraper"

def adlam_ratio(text: str) -> float:
    chars = [c for c in text if not c.isspace()]
    if not chars:
        return 0.0
    adlam = sum(1 for c in chars if 0x1E900 <= ord(c) <= 0x1E95F)
    return adlam / len(chars)

async def main():
    group     = sys.argv[1] if len(sys.argv) > 1 else "adlampular"
    min_ratio = float(sys.argv[2]) if len(sys.argv) > 2 else 0.30

    print(f"Group: {group}  |  Min ratio: {min_ratio}")

    async with TelegramClient(SESSION_FILE, API_ID, API_HASH) as client:
        entity = await client.get_entity(f"https://t.me/{group}")
        saved, skipped, total = 0, 0, 0
        out = Path("output") / f"{group}_low.jsonl"
        with open(out, "w", encoding="utf-8") as f:
            async for msg in client.iter_messages(entity, limit=None):
                if not isinstance(msg, Message) or not msg.text:
                    continue
                total += 1
                ratio = adlam_ratio(msg.text)
                if ratio < min_ratio:
                    skipped += 1
                    continue
                record = {
                    "text": msg.text,
                    "source": group,
                    "message_id": msg.id,
                    "date": msg.date.isoformat(),
                    "adlam_ratio": round(ratio, 4),
                }
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
                saved += 1

    print(f"Saved: {saved}  Skipped: {skipped}  Total: {total}")
    print(f"Output: {out.resolve()}")

asyncio.run(main())
