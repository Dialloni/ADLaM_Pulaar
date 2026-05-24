"""
Gando AI — Web Corpus Scraper
Scrapes ADLaM articles from websites into JSONL corpus.

Sources:
  - tabalde.com   (WordPress REST API)
  - akweeyo.com   (add when structure confirmed)

Usage: python scrape_web.py
Output: output/web_corpus.jsonl
"""

import json
import re
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

import requests

OUTPUT_DIR  = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)
OUTPUT_FILE = OUTPUT_DIR / "web_corpus.jsonl"

ADLAM_MIN_RATIO = 0.50   # lower than Telegram — articles mix ADLaM + punctuation/numbers
DELAY           = 1.0    # seconds between requests

# ── HELPERS ───────────────────────────────────────────────────────────────────

class HTMLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
    def handle_data(self, data):
        self.parts.append(data)
    def get_text(self):
        return " ".join(self.parts)

def strip_html(html: str) -> str:
    s = HTMLStripper()
    s.feed(html)
    text = s.get_text()
    text = re.sub(r"\s+", " ", text).strip()
    return text

def adlam_ratio(text: str) -> float:
    chars = [c for c in text if not c.isspace()]
    if not chars:
        return 0.0
    adlam = sum(1 for c in chars if 0x1E900 <= ord(c) <= 0x1E95F)
    return adlam / len(chars)

def load_existing(path: Path) -> set:
    seen = set()
    if not path.exists():
        return seen
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rec = json.loads(line)
        seen.add(f"{rec['source']}:{rec['message_id']}")
    return seen

# ── SCRAPERS ──────────────────────────────────────────────────────────────────

def scrape_wordpress(site: str, base_url: str, existing: set) -> int:
    """Scrape a WordPress site via REST API."""
    print(f"\n{'─'*60}")
    print(f"  Site : {site}  ({base_url})")

    saved   = 0
    skipped = 0
    page    = 1

    with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
        while True:
            url = f"{base_url}/wp-json/wp/v2/posts?per_page=100&page={page}&_fields=id,date,link,title,content"
            try:
                resp = requests.get(url, timeout=20, headers={"User-Agent": "GandoAI-Scraper/1.0"})
            except requests.RequestException as e:
                print(f"  ✗ Request failed (page {page}): {e}")
                break

            if resp.status_code == 400:
                break  # past last page
            if resp.status_code != 200:
                print(f"  ✗ HTTP {resp.status_code} on page {page}")
                break

            posts = resp.json()
            if not posts:
                break

            for post in posts:
                post_id  = str(post["id"])
                key      = f"{site}:{post_id}"
                if key in existing:
                    skipped += 1
                    continue

                title   = strip_html(post.get("title", {}).get("rendered", ""))
                content = strip_html(post.get("content", {}).get("rendered", ""))
                text    = f"{title}\n\n{content}".strip() if title else content

                if not text:
                    skipped += 1
                    continue

                ratio = adlam_ratio(text)
                if ratio < ADLAM_MIN_RATIO:
                    skipped += 1
                    continue

                date_str = post.get("date", "")
                try:
                    date_iso = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc).isoformat()
                except ValueError:
                    date_iso = date_str

                record = {
                    "text":        text,
                    "source":      site,
                    "message_id":  post_id,
                    "date":        date_iso,
                    "adlam_ratio": round(ratio, 4),
                    "url":         post.get("link", ""),
                }
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
                existing.add(key)
                saved += 1

            print(f"  … page {page}: {len(posts)} posts, {saved} saved so far")
            page += 1
            time.sleep(DELAY)

    print(f"  ✓ Done — {saved} saved, {skipped} skipped")
    return saved

# ── SITES ─────────────────────────────────────────────────────────────────────

WORDPRESS_SITES = [
    ("tabalde.com",  "https://tabalde.com"),
    # ("akweeyo.com", "https://www.akweeyo.com"),  # uncomment once confirmed WP
]

# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    print("Gando AI — Web Scraper")
    existing = load_existing(OUTPUT_FILE)
    print(f"Existing web corpus: {len(existing)} entries")

    total = 0
    for site, base_url in WORDPRESS_SITES:
        total += scrape_wordpress(site, base_url, existing)

    print(f"\n✓ Total new web entries: {total}")
    print(f"  Output: {OUTPUT_FILE.resolve()}")

if __name__ == "__main__":
    main()
