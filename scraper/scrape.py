"""
Gando AI — Telegram ADLaM Corpus Scraper
Scrapes messages from Pulaar/ADLaM Telegram groups and saves as JSONL.
Only keeps messages with ADLaM ratio >= 0.70.
Supports resuming from last scraped message ID.
"""

import asyncio
import json
import os
import re
import time
from datetime import datetime, timez20
one
from pathlib import Path

from telethon import TelegramClient
from telethon.errors import FloodWaitError
from telethon.tl.types import Message
from telethon.sessions import StringSession

# ── CONFIG ────────────────────────────────────────────────────────────────────

API_ID   = int(os.environ.get("TELEGRAM_API_ID",   ""))   # from my.telegram.org
API_HASH = os.environ.get("TELEGRAM_API_HASH",     "")    # from my.telegram.org

SESSION_FILE = StringSession(os.environ.get("TELEGRAM_SESSION", ""))  # use session string from env
OUTPUT_DIR   = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

ADLAM_MIN_RATIO = 0.70   # drop messages with < 70% ADLaM chars
BATCH_SIZE      = 200    # messages per API call (Telegram max = 200)
DELAY_BETWEEN   = 1.5    # seconds between batches (avoid flood)

GROUPS = [
    # original groups
    "defteadlam",
    "adlampular",
    "adlamadlam",
    "+cLcZc6X3uMI5ZGJk",        # private invite link
    "defterebaaheyrenden",
    "Adlamsaradeben",
    # private groups (joined, scrape by numeric ID)
    -1001476533616,              # 𞤏𞤋𞤐𞤁𞤓 𞤀𞤁𞤂𞤢𞤃 (52 members)
    # new public groups
    "Fulfulde",                  # 377 members, ADLaM title
    "SukabeAdlamcameroun",       # 149 members, Cameroon ADLaM
    "SUKAABE",                   # 75 members, Guinea ADLaM
    "cheikhyeroabousy",          # 709 members, Pulaar
    "diagndediina_pulaar",       # 343 members, Pulaar
    "bpulaar",                   # 40 members, Binndol Pulaar
    "oumarbk",                   # 37 members, ADLaM
]

# ── HELPERS ───────────────────────────────────────────────────────────────────

# Safe emoji regex — explicitly excludes ADLaM block (U+1E900–U+1E95F)
EMOJI_RE = re.compile(
    "["
    "\U0001F600-\U0001F64F"   # emoticons
    "\U0001F300-\U0001F5FF"   # symbols & pictographs
    "\U0001F680-\U0001F6FF"   # transport & map
    "\U0001F700-\U0001F77F"   # alchemical
    "\U0001F780-\U0001F7FF"   # geometric extended
    "\U0001F800-\U0001F8FF"   # supplemental arrows
    "\U0001F900-\U0001F9FF"   # supplemental symbols
    "\U0001FA00-\U0001FA6F"   # chess symbols
    "\U0001FA70-\U0001FAFF"   # symbols extended-a
    "\U00002702-\U000027B0"   # dingbats
    "\U000024C2-\U0001E8FF"   # enclosed chars — STOP before ADLaM
    "\U0001E960-\U0001F251"   # resume AFTER ADLaM block ends at U+1E95F
    "]+", flags=re.UNICODE
)

def strip_emoji(text: str) -> str:
    return EMOJI_RE.sub("", text).strip()

def adlam_ratio(text: str) -> float:
    """Fraction of non-whitespace characters in the ADLaM Unicode block."""
    chars = [c for c in text if not c.isspace()]
    if not chars:
        return 0.0
    adlam = sum(1 for c in chars if 0x1E900 <= ord(c) <= 0x1E95F)
    return adlam / len(chars)


def group_key(group) -> str:
    """Stable string key for state/output files."""
    return str(group)

def state_file(group) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9_+]", "_", group_key(group))
    return OUTPUT_DIR / f".state_{safe}.json"


def load_last_id(group) -> int:
    sf = state_file(group)
    if sf.exists():
        return json.loads(sf.read_text()).get("last_id", 0)
    return 0


def save_last_id(group, msg_id: int) -> None:
    state_file(group).write_text(json.dumps({"last_id": msg_id}))


def output_path(group) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9_+]", "_", group_key(group))
    return OUTPUT_DIR / f"{safe}.jsonl"


# ── SCRAPER ───────────────────────────────────────────────────────────────────

async def scrape_group(client: TelegramClient, group) -> None:
    print(f"\n{'─'*60}")
    print(f"  Group : {group}")

    try:
        if isinstance(group, int):
            entity = await client.get_entity(group)
        elif group.startswith("+"):
            entity = await client.get_entity(f"https://t.me/{group}")
        else:
            entity = await client.get_entity(f"https://t.me/{group}")
    except Exception as e:
        print(f"  ✗ Could not resolve '{group}': {e}")
        return

    last_id   = load_last_id(group)
    out_path  = output_path(group)
    saved     = 0
    skipped   = 0
    total     = 0

    print(f"  Resuming from message ID > {last_id}" if last_id else "  Starting fresh")

    with open(out_path, "a", encoding="utf-8") as f:
        async for msg in client.iter_messages(
            entity,
            limit=None,
            min_id=last_id,
            wait_time=DELAY_BETWEEN,
        ):
            if not isinstance(msg, Message) or not msg.text:
                continue

            total += 1
            clean = strip_emoji(msg.text)
            if not clean:
                skipped += 1
                continue
            ratio = adlam_ratio(clean)

            if ratio < ADLAM_MIN_RATIO:
                skipped += 1
                continue

            record = {
                "text":       clean,
                "source":     group_key(group),
                "message_id": msg.id,
                "date":       msg.date.astimezone(timezone.utc).isoformat(),
                "adlam_ratio": round(ratio, 4),
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
            saved += 1

            if saved % 100 == 0:
                save_last_id(group, msg.id)
                print(f"  … {saved} saved / {total} seen")

    print(f"  ✓ Done — {saved} saved, {skipped} skipped ({total} total)")


async def main() -> None:
    if not API_ID or not API_HASH:
        raise SystemExit(
            "Set TELEGRAM_API_ID and TELEGRAM_API_HASH env vars.\n"
            "Get them at https://my.telegram.org"
        )

    print("Gando AI — ADLaM Corpus Scraper")
    print(f"Groups  : {len(GROUPS)}")
    print(f"Min ADLaM ratio : {ADLAM_MIN_RATIO}")
    print(f"Output  : {OUTPUT_DIR.resolve()}")

    async with TelegramClient(SESSION_FILE, API_ID, API_HASH) as client:
        for group in GROUPS:
            try:
                await scrape_group(client, group)
            except FloodWaitError as e:
                print(f"  FloodWait {e.seconds}s — waiting…")
                await asyncio.sleep(e.seconds + 5)
                await scrape_group(client, group)   # retry once
            except Exception as e:
                print(f"  ✗ Error on '{group}': {e}")

    print("\n✓ All groups done.")
    print(f"Output files in: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())
