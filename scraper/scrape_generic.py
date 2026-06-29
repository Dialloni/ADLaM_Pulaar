"""
Gando AI — Generic ADLaM Web Scraper
Scrapes ADLaM (Fulani script) text from ANY website into JSONL corpus.

Unlike scrape_web.py (WordPress REST API only), this handles arbitrary sites:
  - static HTML fetch via requests
  - optional Playwright render (Node) for JS-heavy pages
  - optional same-domain crawl up to --max-pages
Keeps only text with ADLaM ratio >= threshold. Same record format as the
Telegram/web scrapers, so upload_to_firestore.py ingests it unchanged.

Usage:
  python scrape_generic.py https://example.com/page1 https://example.com/page2
  python scrape_generic.py --urls-file urls.txt
  python scrape_generic.py https://akweeyo.com --crawl --max-pages 50
  python scrape_generic.py https://jssite.com --render        # force browser render

Output: output/generic_corpus.jsonl
"""

import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests

SCRIPT_DIR  = Path(__file__).resolve().parent
OUTPUT_DIR  = SCRIPT_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
OUTPUT_FILE = OUTPUT_DIR / "generic_corpus.jsonl"
RENDERER    = SCRIPT_DIR / "playwright_fetch.mjs"

DEFAULT_MIN_RATIO = 0.50   # articles mix ADLaM + punctuation/numbers
DELAY             = 1.0    # seconds between requests
HEADERS           = {"User-Agent": "GandoAI-Scraper/1.0 (+adlam corpus collection)"}

# Safe emoji strip — explicitly skips ADLaM block (U+1E900–U+1E95F).
EMOJI_RE = re.compile(
    "["
    "\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF"
    "\U0001F700-\U0001F77F\U0001F780-\U0001F7FF\U0001F800-\U0001F8FF"
    "\U0001F900-\U0001F9FF\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF"
    "\U00002702-\U000027B0\U000024C2-\U0001E8FF"   # STOP before ADLaM
    "\U0001E960-\U0001F251"                          # resume AFTER ADLaM
    "]+", flags=re.UNICODE
)

# ── HTML → TEXT ─────────────────────────────────────────────────────────────

class HTMLStripper(HTMLParser):
    SKIP = {"script", "style", "noscript", "head", "nav", "footer"}

    def __init__(self):
        super().__init__()
        self.parts = []
        self.links = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip_depth += 1
        if tag == "a":
            for k, v in attrs:
                if k == "href" and v:
                    self.links.append(v)

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data):
        if self._skip_depth == 0:
            self.parts.append(data)

    def get_text(self):
        text = " ".join(self.parts)
        return re.sub(r"\s+", " ", text).strip()


def parse_html(html: str):
    s = HTMLStripper()
    s.feed(html)
    return s.get_text(), s.links

# ── HELPERS ─────────────────────────────────────────────────────────────────

def strip_emoji(text: str) -> str:
    return EMOJI_RE.sub("", text).strip()

def adlam_ratio(text: str) -> float:
    chars = [c for c in text if not c.isspace()]
    if not chars:
        return 0.0
    adlam = sum(1 for c in chars if 0x1E900 <= ord(c) <= 0x1E95F)
    return adlam / len(chars)

def url_id(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]

def domain_of(url: str) -> str:
    return urlparse(url).netloc.removeprefix("www.")

def load_existing(path: Path) -> set:
    seen = set()
    if not path.exists():
        return seen
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rec = json.loads(line)
            seen.add(f"{rec['source']}:{rec['message_id']}")
    return seen

def fetch_static(url: str) -> str | None:
    try:
        resp = requests.get(url, timeout=20, headers=HEADERS)
        if resp.status_code == 200:
            return resp.text
        print(f"  ✗ HTTP {resp.status_code}: {url}")
    except requests.RequestException as e:
        print(f"  ✗ request failed: {url} ({e})")
    return None

def fetch_rendered(url: str) -> str | None:
    if not RENDERER.exists():
        print(f"  ✗ renderer missing: {RENDERER}")
        return None
    try:
        proc = subprocess.run(
            ["node", str(RENDERER), url, "30000"],
            capture_output=True, text=True, timeout=60,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout
        print(f"  ✗ render failed: {url} ({proc.stderr.strip()[:120]})")
    except FileNotFoundError:
        print("  ✗ 'node' not found — install Node to use --render")
    except subprocess.TimeoutExpired:
        print(f"  ✗ render timeout: {url}")
    return None

# ── CORE ────────────────────────────────────────────────────────────────────

def process_url(url: str, render: bool, min_ratio: float, existing: set, out) -> tuple[int, list]:
    """Fetch one URL, save if ADLaM-rich. Returns (saved_count, discovered_links)."""
    site = domain_of(url)
    key  = f"{site}:{url_id(url)}"
    if key in existing:
        return 0, []

    html = fetch_rendered(url) if render else fetch_static(url)
    if html is None:
        return 0, []

    text, links = parse_html(html)
    text = strip_emoji(text)
    ratio = adlam_ratio(text)

    # Static page had no ADLaM? Retry with browser render (JS-loaded text).
    if ratio < min_ratio and not render:
        rhtml = fetch_rendered(url)
        if rhtml:
            text, links = parse_html(rhtml)
            text = strip_emoji(text)
            ratio = adlam_ratio(text)

    if not text or ratio < min_ratio:
        print(f"  · skip (ratio {ratio:.2f}): {url}")
        return 0, links

    record = {
        "text":        text,
        "source":      site,
        "message_id":  url_id(url),
        "date":        datetime.now(timezone.utc).isoformat(),
        "adlam_ratio": round(ratio, 4),
        "url":         url,
    }
    out.write(json.dumps(record, ensure_ascii=False) + "\n")
    out.flush()
    existing.add(key)
    print(f"  ✓ saved (ratio {ratio:.2f}): {url}")
    return 1, links

def crawl(seeds: list[str], render: bool, min_ratio: float, max_pages: int,
          same_domain: bool, existing: set) -> int:
    queue   = list(seeds)
    visited = set()
    saved   = 0
    seed_domains = {domain_of(u) for u in seeds}

    with open(OUTPUT_FILE, "a", encoding="utf-8") as out:
        while queue and len(visited) < max_pages:
            url = queue.pop(0)
            url = url.split("#")[0]
            if url in visited:
                continue
            visited.add(url)

            n, links = process_url(url, render, min_ratio, existing, out)
            saved += n
            time.sleep(DELAY)

            if same_domain:
                for href in links:
                    nxt = urljoin(url, href)
                    if not nxt.startswith("http"):
                        continue
                    if domain_of(nxt) in seed_domains and nxt not in visited:
                        queue.append(nxt)
    return saved

# ── MAIN ────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Generic ADLaM web scraper")
    ap.add_argument("urls", nargs="*", help="URLs to scrape")
    ap.add_argument("--urls-file", help="File with one URL per line")
    ap.add_argument("--render", action="store_true", help="Force Playwright render")
    ap.add_argument("--crawl", action="store_true", help="Follow same-domain links")
    ap.add_argument("--max-pages", type=int, default=25, help="Max pages when crawling")
    ap.add_argument("--min-ratio", type=float, default=DEFAULT_MIN_RATIO, help="Min ADLaM ratio")
    args = ap.parse_args()

    seeds = list(args.urls)
    if args.urls_file:
        seeds += [l.strip() for l in Path(args.urls_file).read_text().splitlines() if l.strip()]
    if not seeds:
        sys.exit("Provide URLs or --urls-file. See --help.")

    existing = load_existing(OUTPUT_FILE)
    print(f"Gando AI — Generic Scraper")
    print(f"  seeds: {len(seeds)}  render: {args.render}  crawl: {args.crawl}  min_ratio: {args.min_ratio}")
    print(f"  existing: {len(existing)} entries")

    saved = crawl(seeds, args.render, args.min_ratio,
                  args.max_pages if args.crawl else len(seeds),
                  same_domain=args.crawl, existing=existing)

    print(f"\n✓ {saved} new entries → {OUTPUT_FILE}")
    print("  Next: python upload_to_firestore.py --file output/generic_corpus.jsonl")

if __name__ == "__main__":
    main()
