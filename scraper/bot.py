"""
Gando AI — Telegram Bot
Two-way bot: responds to commands, triggers sync, reports corpus stats.

Commands:
  /start             — welcome message
  /status            — corpus stats from Firestore
  /sync              — trigger manual scrape + upload
  /pending           — how many entries awaiting review
  /next              — preview next pending entry
  /approve <id>      — mark entry as verified
  /reject <id>       — mark entry as rejected
  /help              — list commands

Run: python bot.py
Keep running in background: nohup python bot.py &
"""

import asyncio
import base64
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta
import hashlib
import time
from zoneinfo import ZoneInfo

import urllib.request
import urllib.error
import urllib.parse

GEMINI_API_KEY  = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL_ID = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
try:
    from google import genai
    from google.genai import types as genai_types
    gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
except ImportError:
    gemini_client, genai_types = None, None


class _GeminiCompat:
    """Shim: keep existing gemini_model.generate_content(text | [parts]) calls working
    on the new google-genai SDK. response.text still works."""
    def __init__(self, client, model):
        self.client, self.model = client, model

    def generate_content(self, contents):
        return self.client.models.generate_content(model=self.model, contents=contents)


gemini_model = _GeminiCompat(gemini_client, GEMINI_MODEL_ID) if gemini_client else None

try:
    from telethon import TelegramClient, events
    from telethon.sessions import StringSession
except ImportError:
    sys.exit("Run: pip install telethon")

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    sys.exit("Run: pip install firebase-admin")

# ── CONFIG ────────────────────────────────────────────────────────────────────

BOT_TOKEN   = os.environ.get("TELEGRAM_BOT_TOKEN", "")
CHAT_ID     = int(os.environ.get("TELEGRAM_CHAT_ID", "0"))
API_ID      = int(os.environ.get("TELEGRAM_API_ID", "0"))
API_HASH    = os.environ.get("TELEGRAM_API_HASH", "")
DB_ID       = os.environ.get("FIRESTORE_DB_ID", "ai-studio-7ad94b26-04fc-4e1e-8215-809796583202")
SCRAPER_DIR = os.path.dirname(os.path.abspath(__file__))

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPO  = os.environ.get("GITHUB_REPO", "")  # e.g. "abubakardiallo/gando-brain"

# ── HARVEST (scheduled auto-collection) ───────────────────────────────────────
# Web sources to scrape; Telegram groups optional (need a USER session, not the bot token).
HARVEST_URLS  = [u.strip() for u in os.environ.get(
    "HARVEST_URLS", "https://tabalde.com,https://akweeyo.com").split(",") if u.strip()]
HARVEST_HOURS = [int(h) for h in os.environ.get("HARVEST_HOURS", "14,17,20").split(",") if h.strip()]
HARVEST_TZ        = os.environ.get("HARVEST_TZ", "America/New_York")
HARVEST_MIN_RATIO = float(os.environ.get("HARVEST_MIN_RATIO", "0.45"))
HARVEST_MAX_PAGES = int(os.environ.get("HARVEST_MAX_PAGES", "20"))
# Telegram group harvest (phase 2): set HARVEST_GROUPS (comma list of @usernames/ids)
# and TELEGRAM_USER_SESSION (a Telethon StringSession for your USER account).
HARVEST_GROUPS        = [g.strip() for g in os.environ.get("HARVEST_GROUPS", "").split(",") if g.strip()]
# Accept either name — TELEGRAM_USER_SESSION (preferred) or the existing TELEGRAM_SESSION.
TELEGRAM_USER_SESSION = os.environ.get("TELEGRAM_USER_SESSION") or os.environ.get("TELEGRAM_SESSION", "")

if not all([BOT_TOKEN, CHAT_ID, API_ID, API_HASH]):
    sys.exit("Missing env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_API_ID, TELEGRAM_API_HASH")

# ── FIREBASE ──────────────────────────────────────────────────────────────────

raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY", "")
if raw and not firebase_admin._apps:
    cred = credentials.Certificate(json.loads(raw))
    firebase_admin.initialize_app(cred)
    db = firestore.client(database_id=DB_ID)
else:
    db = None

# ── HELPERS ───────────────────────────────────────────────────────────────────

def get_corpus_stats():
    if not db:
        return "Firebase not connected."
    col = db.collection("corpus_submissions")
    docs = list(col.stream())
    total    = len(docs)
    pending  = sum(1 for d in docs if d.to_dict().get("status") == "pending")
    verified = sum(1 for d in docs if d.to_dict().get("status") == "verified")
    rejected = sum(1 for d in docs if d.to_dict().get("status") == "rejected")
    sources  = {}
    for d in docs:
        src = d.to_dict().get("source", "unknown")
        sources[src] = sources.get(src, 0) + 1
    src_lines = "\n".join(f"  • {k}: {v}" for k, v in sorted(sources.items(), key=lambda x: -x[1]))
    return (
        f"📚 <b>Corpus Stats</b>\n"
        f"Total: <b>{total}</b>\n"
        f"✅ Verified: <b>{verified}</b>\n"
        f"⏳ Pending: <b>{pending}</b>\n"
        f"❌ Rejected: <b>{rejected}</b>\n\n"
        f"<b>By source:</b>\n{src_lines}"
    )

# Rough blended $/1M tokens by model family — mirrors lib/tokenUsage.ts. For the
# /usage readout and spend alert only, NOT billing. On the high side on purpose.
RATE_PER_MTOK = [
    (re.compile(r"haiku", re.I), 2.0),
    (re.compile(r"opus", re.I), 45.0),
    (re.compile(r"sonnet", re.I), 9.0),
    (re.compile(r"gemini.*pro|2\.5-pro", re.I), 5.0),
    (re.compile(r"flash", re.I), 0.3),
    (re.compile(r"gpt|deepseek|groq|llama|qwen|mistral", re.I), 1.0),
]
DEFAULT_RATE = 5.0

def _estimate_usd(by_model: dict, total: int) -> float:
    if not by_model:
        return (total / 1e6) * DEFAULT_RATE
    usd = 0.0
    for model, toks in by_model.items():
        rate = next((r for rx, r in RATE_PER_MTOK if rx.search(str(model))), DEFAULT_RATE)
        usd += (float(toks) / 1e6) * rate
    return usd

def _get_spend_limit() -> float:
    """Live daily $ ceiling from config/runtime (set via /setlimit), else env, else 5."""
    if db:
        try:
            c = db.collection("config").document("runtime").get()
            if c.exists:
                v = (c.to_dict() or {}).get("spendAlertUsd")
                if isinstance(v, (int, float)) and v > 0:
                    return float(v)
        except Exception:
            pass
    env = os.environ.get("SPEND_ALERT_USD", "5").replace('"', '').replace("'", "")
    try:
        return float(env)
    except ValueError:
        return 5.0

def set_spend_limit(val: float) -> str:
    """Write the daily $ ceiling to config/runtime and re-arm today's alert."""
    if not db:
        return "Firebase not connected."
    db.collection("config").document("runtime").set({"spendAlertUsd": val}, merge=True)
    # Clear today's fired flag so the new limit can trigger a fresh alert.
    day = datetime.utcnow().strftime("%Y-%m-%d")
    db.collection("usage_tokens").document(day).set({"spendAlertSent": False}, merge=True)
    return f"✅ Daily spend limit set to <b>${val:.2f}</b>.\nAlert re-armed for today."

def get_usage_stats():
    """Today's AI spend from usage_tokens/<day> (written by lib/tokenUsage.ts)."""
    if not db:
        return "Firebase not connected."
    day = datetime.utcnow().strftime("%Y-%m-%d")
    snap = db.collection("usage_tokens").document(day).get()
    if not snap.exists:
        return f"💸 <b>Usage — {day} (UTC)</b>\nNo AI usage recorded yet today."
    d = snap.to_dict() or {}
    total   = int(d.get("total", 0))
    in_tok  = int(d.get("inTok", 0))
    out_tok = int(d.get("outTok", 0))
    calls   = int(d.get("calls", 0))
    by_model = d.get("byModel", {}) or {}
    by_kind  = d.get("byKind", {}) or {}
    usd = _estimate_usd(by_model, total)
    limit = f"{_get_spend_limit():.2f}"
    model_lines = "\n".join(
        f"  • {m}: {int(t):,} tok" for m, t in sorted(by_model.items(), key=lambda x: -x[1])
    ) or "  (none)"
    kind_lines = "\n".join(
        f"  • {k}: {int(t):,} tok" for k, t in sorted(by_kind.items(), key=lambda x: -x[1])
    ) or "  (none)"
    return (
        f"💸 <b>Usage — {day} (UTC)</b>\n"
        f"Est. cost: <b>${usd:.2f}</b> / ${limit} limit\n"
        f"Tokens: <b>{total:,}</b> ({in_tok:,} in / {out_tok:,} out)\n"
        f"Calls: <b>{calls}</b>\n\n"
        f"<b>By model:</b>\n{model_lines}\n\n"
        f"<b>By route:</b>\n{kind_lines}"
    )

sync_running = False
last_pending_id = None  # track last /next result for quick approve/reject

# ── GITHUB PUSH ───────────────────────────────────────────────────────────────

def push_to_github(file_path: str, content: str, commit_msg: str) -> tuple[bool, str]:
    """Push a file to the gando-brain GitHub repo via REST API."""
    if not GITHUB_TOKEN or not GITHUB_REPO:
        return False, "GITHUB_TOKEN or GITHUB_REPO not set in env vars."
    encoded_path = urllib.parse.quote(file_path, safe="/")
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{encoded_path}"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
    }
    encoded = base64.b64encode(content.encode("utf-8")).decode("utf-8")

    # Check if file exists to get its SHA (required for updates)
    sha = None
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp:
            existing = json.loads(resp.read())
            sha = existing.get("sha")
    except urllib.error.HTTPError as e:
        if e.code != 404:
            return False, f"GitHub GET error: {e.code}"

    payload = {"message": commit_msg, "content": encoded}
    if sha:
        payload["sha"] = sha

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="PUT")
        with urllib.request.urlopen(req):
            pass
        return True, f"https://github.com/{GITHUB_REPO}/blob/main/{file_path}"
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        return False, f"GitHub PUT error {e.code}: {body[:200]}"

def run_sync():
    global sync_running
    sync_running = True
    try:
        result = subprocess.run(
            ["bash", "sync.sh"],
            cwd=SCRAPER_DIR,
            capture_output=True,
            text=True,
            timeout=600,
        )
        return result.returncode == 0, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return False, "Sync timed out after 10 minutes."
    finally:
        sync_running = False

# ── HARVESTER ─────────────────────────────────────────────────────────────────

def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()

def _text_hash(text: str) -> str:
    return hashlib.sha1(_norm(text).encode("utf-8")).hexdigest()

def _adlam_ratio(text: str) -> float:
    chars = [c for c in text if not c.isspace()]
    if not chars:
        return 0.0
    return sum(1 for c in chars if 0x1E900 <= ord(c) <= 0x1E95F) / len(chars)

_ADLAM_KEYWORDS = ("adlam", "pular", "pulaar", "fulfulde", "fulbe", "fulani", "peul", "fula")

def _is_adlam_name(name: str) -> bool:
    """Heuristic: group name has ADLaM script or a Fulani keyword."""
    if not name:
        return False
    if any(0x1E900 <= ord(c) <= 0x1E95F for c in name):
        return True
    n = name.lower()
    return any(k in n for k in _ADLAM_KEYWORDS)

def _load_seen_hashes() -> set:
    """Content hashes already in the corpus — used to skip duplicates."""
    seen = set()
    if not db:
        return seen
    for d in db.collection("corpus_submissions").stream():
        doc = d.to_dict()
        h = doc.get("content_hash")
        if h:
            seen.add(h)
        elif doc.get("raw_text"):
            seen.add(_text_hash(doc["raw_text"]))
    return seen

def _harvest_wp(base: str, seen: set, parse_html, strip_emoji):
    """WordPress REST API path: clean title+content per post, stable content hash
    (no nav/sidebar boilerplate, so widget churn can't re-ingest old articles).
    Returns (records, posts_checked), or None if the site isn't WordPress or the
    API is blocked — caller falls back to the HTML crawl."""
    import requests
    from urllib.parse import urlparse
    site = urlparse(base).netloc.removeprefix("www.")
    records, checked = [], 0
    for page in range(1, 6):  # newest-first, ≤500 posts per run
        url = (f"{base.rstrip('/')}/wp-json/wp/v2/posts"
               f"?per_page=100&page={page}&_fields=id,link,title,content")
        try:
            resp = requests.get(url, timeout=20,
                                headers={"User-Agent": "GandoAI-Scraper/1.0"})
        except requests.RequestException as e:
            if page == 1:
                print(f"harvest: {site} WP API unreachable ({e})", flush=True)
                return None
            break
        if resp.status_code == 400:  # past last page
            break
        if resp.status_code != 200:
            if page == 1:
                return None
            break
        try:
            posts = resp.json()
        except ValueError:
            return None if page == 1 else (records, checked)
        if not isinstance(posts, list) or not posts:
            if page == 1 and not isinstance(posts, list):
                return None
            break
        new_on_page = 0
        for post in posts:
            checked += 1
            title   = strip_emoji(parse_html((post.get("title") or {}).get("rendered", ""))[0])
            content = strip_emoji(parse_html((post.get("content") or {}).get("rendered", ""))[0])
            text    = f"{title}\n\n{content}".strip() if title else content.strip()
            if not text:
                continue
            ratio = _adlam_ratio(text)
            if ratio < HARVEST_MIN_RATIO:
                continue
            h = _text_hash(text)
            if h in seen:
                continue
            seen.add(h)
            new_on_page += 1
            records.append({"text": text, "source": site,
                            "url": post.get("link"), "ratio": ratio, "hash": h})
        if new_on_page == 0 or len(posts) < 100:
            break  # newest-first: a page with nothing new means older pages have nothing new
        time.sleep(1.0)
    return records, checked

def _harvest_web(seen: set) -> list:
    """Scrape HARVEST_URLS for new ADLaM-rich text. WordPress API first (clean,
    stable per-post records); HTML crawl only for non-WP sites. Blocking."""
    from urllib.parse import urljoin, urlparse
    import sys as _sys
    if SCRAPER_DIR not in _sys.path:
        _sys.path.insert(0, SCRAPER_DIR)
    try:
        from scrape_generic import parse_html, strip_emoji, fetch_static, fetch_rendered
    except Exception as e:
        print(f"harvest: scrape_generic import failed: {e}", flush=True)
        return [], 0, f"import: {e}"

    def domain(u: str) -> str:
        return urlparse(u).netloc.removeprefix("www.")

    records, visited = [], set()
    queue, wp_checked = [], 0
    for base in HARVEST_URLS:
        wp = _harvest_wp(base, seen, parse_html, strip_emoji)
        if wp is None:
            queue.append(base)  # not WordPress → existing HTML crawl below
            continue
        wp_records, checked = wp
        wp_checked += checked
        records.extend(wp_records)
        print(f"harvest: {domain(base)} via WP API — {checked} posts checked, {len(wp_records)} new", flush=True)
    seed_domains = {domain(u) for u in queue}

    while queue and len(visited) < HARVEST_MAX_PAGES:
        url = queue.pop(0).split("#")[0]
        if url in visited:
            continue
        visited.add(url)

        html = fetch_static(url)
        links = []
        if html:
            text, links = parse_html(html)
            text = strip_emoji(text)
            ratio = _adlam_ratio(text)
            if ratio < HARVEST_MIN_RATIO:
                rhtml = fetch_rendered(url)  # no-op if 'node' absent → returns None
                if rhtml:
                    text, links = parse_html(rhtml)
                    text = strip_emoji(text)
                    ratio = _adlam_ratio(text)
            if text and ratio >= HARVEST_MIN_RATIO:
                h = _text_hash(text)
                if h not in seen:
                    seen.add(h)
                    records.append({"text": text, "source": domain(url), "url": url, "ratio": ratio, "hash": h})

        for href in links:
            nxt = urljoin(url, href).split("#")[0]
            if nxt.startswith("http") and domain(nxt) in seed_domains and nxt not in visited:
                queue.append(nxt)
        time.sleep(1.0)
    return records, len(visited) + wp_checked, None

async def _harvest_groups(seen: set) -> list:
    """Read new messages from HARVEST_GROUPS via a USER session (bot tokens can't). Optional."""
    records = []
    info = {"session": "none", "groups": 0, "msgs": 0, "err": None}
    if not TELEGRAM_USER_SESSION:
        return records, info
    msgs_total = 0
    try:
        user = TelegramClient(StringSession(TELEGRAM_USER_SESSION), API_ID, API_HASH)
        await user.connect()
        if not await user.is_user_authorized():
            await user.disconnect()
            print("harvest: user session not authorized — skipping group harvest")
            info["session"] = "unauthorized"
            return records, info

        # Don't let a Telegram rate-limit (FloodWait) freeze the run: auto-wait only
        # short throttles; longer ones raise and the per-group except skips that group.
        user.flood_sleep_threshold = 30
        budget_start = time.monotonic()

        # Targets: explicit HARVEST_GROUPS, else auto-scan every group/channel the
        # account is in (only ADLaM-script messages survive the ratio filter).
        targets = []  # (label, peer)
        if HARVEST_GROUPS:
            targets = [(g, g) for g in HARVEST_GROUPS]
        else:
            async for dialog in user.iter_dialogs():
                if dialog.is_group or dialog.is_channel:
                    targets.append((dialog.name or str(dialog.id), dialog.id))

        for label, peer in targets:
            if time.monotonic() - budget_start > 90:
                print("harvest: 90s time budget reached — stopping group scan early")
                break
            try:
                key = "harvest_lastid_" + re.sub(r"[^a-zA-Z0-9]", "_", str(peer))
                last_id = 0
                if db:
                    snap = db.collection("harvest_state").document(key).get()
                    if snap.exists:
                        last_id = snap.to_dict().get("last_id", 0)
                max_seen = last_id
                async for msg in user.iter_messages(peer, min_id=last_id, limit=120):
                    max_seen = max(max_seen, msg.id)
                    msgs_total += 1
                    body = (msg.text or "").strip()
                    if not body:
                        continue
                    ratio = _adlam_ratio(body)
                    if ratio < HARVEST_MIN_RATIO:
                        continue
                    h = _text_hash(body)
                    if h in seen:
                        continue
                    seen.add(h)
                    records.append({"text": body, "source": f"telegram:{label}", "url": None, "ratio": ratio, "hash": h})
                if db and max_seen > last_id:
                    db.collection("harvest_state").document(key).set({"last_id": max_seen})
            except Exception as e:
                print(f"harvest: group {label} failed: {e}")
        await user.disconnect()
        info.update({"session": "ok", "groups": len(targets), "msgs": msgs_total})
    except Exception as e:
        print(f"harvest: user client error: {e}", flush=True)
        info["session"] = "error"
        info["err"] = f"{type(e).__name__}: {e}"
    return records, info

async def run_harvest(client, reason: str = "scheduled"):
    """Scrape sources → dedup → corpus (pending) → Obsidian note → Telegram summary."""
    if not db:
        await client.send_message(CHAT_ID, "⚠️ Harvest skipped — Firebase not connected.")
        return
    await client.send_message(CHAT_ID, f"🔍 Harvest started ({reason})…")
    seen                     = await asyncio.to_thread(_load_seen_hashes)
    web, web_pages, web_err  = await asyncio.to_thread(_harvest_web, seen)
    groups, ginfo            = await _harvest_groups(seen)
    records                  = web + groups

    added, per_source = 0, {}
    for r in records:
        try:
            db.collection("corpus_submissions").add({
                "raw_text": r["text"],
                "source": r["source"],
                "adlam_ratio": r["ratio"],
                "word_count": len(r["text"].split()),
                "status": "pending",
                "submitted_at": firestore.SERVER_TIMESTAMP,
                "content_hash": r["hash"],
                "url": r.get("url"),
                "harvested": True,
            })
            added += 1
            per_source[r["source"]] = per_source.get(r["source"], 0) + 1
        except Exception as e:
            print(f"harvest: firestore add failed: {e}")

    sess_note = {
        "ok": f"✅ read {ginfo['groups']} groups, {ginfo['msgs']} msgs",
        "unauthorized": "⚠️ session INVALID — regenerate TELEGRAM_SESSION",
        "none": "— no session set (web only)",
        "error": "⚠️ session error (see logs)",
    }.get(ginfo["session"], ginfo["session"])

    if added == 0:
        detail = ""
        if web_err:
            detail += f"\n🌐 web error: {web_err}"
        if ginfo.get("err"):
            detail += f"\n💬 session error: {ginfo['err']}"
        await client.send_message(
            CHAT_ID,
            f"✅ Harvest done ({reason}). No NEW text found.\n\n"
            f"🌐 Web pages checked: {web_pages}\n"
            f"💬 Telegram: {sess_note}{detail}\n\n"
            f"(Anything found was already in the corpus, or below the ADLaM threshold.)",
        )
        return

    lines = "\n".join(f"  • {k}: {v}" for k, v in sorted(per_source.items(), key=lambda x: -x[1]))
    await client.send_message(CHAT_ID, f"✅ Harvest done ({reason}).\nAdded <b>{added}</b> new entries → pending review.\n\n<b>By source:</b>\n{lines}\n\n🌐 web pages: {web_pages} · 💬 {sess_note}", parse_mode="html")

    # Obsidian note
    now  = datetime.utcnow()
    slug = now.strftime("%Y-%m-%d-%H%M%S")
    md   = (f"---\ncreated: {now.strftime('%Y-%m-%d %H:%M UTC')}\nsource: auto_harvest\ntrigger: {reason}\n---\n\n"
            f"# ADLaM Harvest {slug}\n\nAdded **{added}** new entries to the corpus (pending review).\n\n## By source\n"
            + "\n".join(f"- {k}: {v}" for k, v in per_source.items()) + "\n\n## Samples\n")
    for r in records[:5]:
        src = f"<{r['url']}>" if r.get("url") else r["source"]
        md += f"\n### {r['source']}\n{src}\n\n{r['text'][:400]}…\n"
    push_to_github(f"01 - Inbox/{slug}-harvest.md", md, f"harvest: {added} new ADLaM entries")

def _seconds_until_next_harvest() -> float:
    tz  = ZoneInfo(HARVEST_TZ)
    now = datetime.now(tz)
    candidates = []
    for day in (0, 1):
        base = (now + timedelta(days=day)).replace(minute=0, second=0, microsecond=0)
        for h in HARVEST_HOURS:
            t = base.replace(hour=h)
            if t > now:
                candidates.append(t)
    return (min(candidates) - now).total_seconds()

async def list_user_groups():
    """List every group/channel the USER session belongs to (name + @username/id)."""
    if not TELEGRAM_USER_SESSION:
        return "no_session"
    user = TelegramClient(StringSession(TELEGRAM_USER_SESSION), API_ID, API_HASH)
    try:
        await user.connect()
        if not await user.is_user_authorized():
            return "unauth"
        items = []
        async for dialog in user.iter_dialogs():
            if dialog.is_group or dialog.is_channel:
                uname = getattr(dialog.entity, "username", None)
                ident = f"@{uname}" if uname else str(dialog.id)
                adlam = _is_adlam_name(dialog.name)
                mark  = "⭐ " if adlam else "• "
                items.append((adlam, f"{mark}{dialog.name} → {ident}"))
        items.sort(key=lambda x: (not x[0]))  # ADLaM-likely (⭐) first
        return [text for _, text in items]
    finally:
        await user.disconnect()

async def harvest_scheduler(client):
    while True:
        try:
            secs = _seconds_until_next_harvest()
        except Exception as e:
            print(f"harvest: scheduler error: {e}")
            secs = 3600
        await asyncio.sleep(secs)
        try:
            await run_harvest(client, reason="scheduled")
        except Exception as e:
            print(f"harvest: run error: {e}")
            try:
                await client.send_message(CHAT_ID, f"❌ Harvest error: {e}")
            except Exception:
                pass

# ── BOT ───────────────────────────────────────────────────────────────────────

async def main():
    # Bot uses bot_token auth — no user session needed (StringSession("") = fresh bot session)
    client = TelegramClient(StringSession(""), API_ID, API_HASH)
    await client.start(bot_token=BOT_TOKEN)
    print(f"✓ Gando bot running. Listening for commands from chat {CHAT_ID}...")

    @client.on(events.NewMessage(chats=CHAT_ID))
    async def voice_handler(event):
        """Handle voice messages — transcribe then process as command."""
        if not event.message.voice and not event.message.audio:
            return
        if not gemini_model:
            await event.respond("Gemini not configured. Set GEMINI_API_KEY.")
            return
        await event.respond("🎤 Transcribing voice message…")
        try:
            audio_bytes = await event.message.download_media(bytes)
            response = gemini_model.generate_content([
                genai_types.Part.from_bytes(data=audio_bytes, mime_type="audio/ogg"),
                "Transcribe this audio exactly as spoken. Return only the transcribed text, no commentary."
            ])
            transcribed = response.text.strip()
            await event.respond(f"📝 Heard: {transcribed}\n\nProcessing…")

            # Smart intent detection via Gemini
            intent_prompt = f"""You are a command router for the Gando AI Telegram bot.

The user sent this voice message: "{transcribed}"

Classify the intent into exactly one of these JSON responses:
- {{"intent": "note", "body": "<the note content to save>"}}
- {{"intent": "research", "topic": "<the research topic>"}}
- {{"intent": "status"}}
- {{"intent": "corpus", "text": "<the ADLaM text to add>"}}
- {{"intent": "ask", "question": "<the question to answer>"}}

Rules:
- "note" = user wants to save a reminder, thought, or idea
- "research" = user wants a research note on a topic saved to Obsidian
- "status" = user wants corpus stats
- "corpus" = user wants to add ADLaM text to the corpus
- "ask" = anything else, general question

Return ONLY valid JSON. No markdown, no explanation."""

            intent_res = gemini_model.generate_content(intent_prompt)
            intent_raw = intent_res.text.strip().replace("```json", "").replace("```", "").strip()

            try:
                intent = json.loads(intent_raw)
            except Exception:
                intent = {"intent": "ask", "question": transcribed}

            action = intent.get("intent", "ask")

            if action == "note":
                body = intent.get("body", transcribed)
                now = datetime.utcnow()
                slug = now.strftime("%Y-%m-%d-%H%M%S")
                filename = f"01 - Inbox/{slug}-voice-note.md"
                md = f"---\ncreated: {now.strftime('%Y-%m-%d %H:%M UTC')}\nsource: telegram_voice\n---\n\n{body}\n"
                ok, result = push_to_github(filename, md, f"note: voice capture {slug}")
                if ok:
                    await event.respond(f"✅ Voice note saved to Obsidian.\n{result}")
                else:
                    await event.respond(f"❌ Failed: {result}")

            elif action == "research":
                topic = intent.get("topic", transcribed)
                prompt = (
                    f"Write a structured Markdown research note about: {topic}\n"
                    f"Context: Gando AI — African-language-first app builder, ADLaM/Pulaar focus.\n"
                    f"Format: # title\n## Overview\n## Key Facts\n## Relevance to ADLaM\n## Resources\n## Next Steps"
                )
                res = gemini_model.generate_content(prompt)
                note_md = res.text.strip()
                now = datetime.utcnow()
                slug = re.sub(r"[^a-z0-9]+", "-", topic.lower())[:40]
                filename = f"03 - Areas/ADLaM Language/{now.strftime('%Y-%m-%d')}-{slug}.md"
                ok, result = push_to_github(filename, note_md, f"research: {topic[:60]}")
                if ok:
                    await event.respond(f"✅ Research note saved to Obsidian.\n{result}\n\nPreview:\n{note_md[:300]}…")
                else:
                    await event.respond(f"❌ Failed: {result}")

            elif action == "status":
                stats = get_corpus_stats()
                await event.respond(stats, parse_mode="html")

            elif action == "corpus":
                text_body = intent.get("text", transcribed)
                if not db:
                    await event.respond("Firebase not connected.")
                else:
                    adlam_chars = sum(1 for c in text_body if 0x1E900 <= ord(c) <= 0x1E95F)
                    ratio = adlam_chars / max(len(text_body), 1)
                    db.collection("corpus_submissions").add({
                        "raw_text": text_body,
                        "source": "telegram_voice",
                        "adlam_ratio": ratio,
                        "word_count": len(text_body.split()),
                        "status": "pending",
                        "submitted_at": firestore.SERVER_TIMESTAMP,
                    })
                    await event.respond(f"✅ Added to corpus pipeline.\nADLaM ratio: {ratio:.0%}")

            else:
                # ask — general question
                question = intent.get("question", transcribed)
                res = gemini_model.generate_content(
                    f"You are the Gando AI assistant helping Abubakar Diallo build an African-language-first app. "
                    f"Answer concisely (under 150 words): {question}"
                )
                await event.respond(res.text.strip())

        except Exception as e:
            await event.respond(f"❌ Voice processing error: {e}")

    @client.on(events.NewMessage(chats=CHAT_ID))
    async def handler(event):
        global sync_running, last_pending_id
        if event.message.voice or event.message.audio:
            return  # handled by voice_handler
        raw_msg = event.message.text.strip()
        text = raw_msg.lower()

        if text in ("/start", "start"):
            await event.respond(
                "𞤘𞤢𞤲𞤣𞤮 AI Bot 🤖\n\n"
                "Commands:\n"
                "/status — corpus stats\n"
                "/usage — today's AI spend 💸\n"
                "/setlimit <$> — set daily spend alert limit\n"
                "/pending — pending review count\n"
                "/next — preview next pending entry\n"
                "/approve <id> — verify entry\n"
                "/reject <id> — reject entry\n"
                "/sync — trigger manual sync\n"
                "/ask <question> — ask Gemini anything\n"
                "/research <topic> — research + save to Obsidian\n"
                "/note <text> — quick note to Obsidian inbox\n"
                "/add-term <adlam> = <english> — add to ADLaM dictionary\n"
                "/corpus <adlam text> — add text to corpus pipeline\n"
                "/help — this message"
            )

        elif text in ("/help", "help"):
            await event.respond(
                "<b>Gando AI Bot Commands</b>\n\n"
                "<b>Corpus</b>\n"
                "/status — full corpus stats\n"
                "/pending — entries awaiting review\n"
                "/next — preview next pending entry\n"
                "/approve &lt;id&gt; — mark entry as verified\n"
                "/reject &lt;id&gt; — mark entry as rejected\n"
                "/sync — run scraper + upload now\n"
                "/corpus &lt;adlam text&gt; — manually add ADLaM text\n\n"
                "<b>Obsidian / Research</b>\n"
                "/research &lt;topic&gt; — AI research note → saved to Obsidian\n"
                "/note &lt;text&gt; — quick capture → Obsidian inbox\n"
                "/add-term &lt;adlam&gt; = &lt;english&gt; — add to ADLaM dictionary\n\n"
                "<b>AI</b>\n"
                "/ask &lt;question&gt; — ask Gemini anything\n\n"
                "<b>Spend</b>\n"
                "/usage — today's token usage + estimated $ cost\n"
                "/setlimit &lt;$&gt; — change the daily spend alert limit (e.g. /setlimit 3)\n\n"
                "<b>Harvest</b>\n"
                "/harvest — scrape ADLaM sources now → corpus (auto-runs daily)",
                parse_mode="html"
            )

        elif text in ("/status", "status"):
            await event.respond("Fetching stats…")
            stats = get_corpus_stats()
            await event.respond(stats, parse_mode="html")

        elif text in ("/usage", "usage", "/spend", "spend"):
            await event.respond(get_usage_stats(), parse_mode="html")

        elif text.startswith("/setlimit") or text.startswith("setlimit"):
            parts = raw_msg.split()
            if len(parts) < 2:
                await event.respond(f"Current limit: <b>${_get_spend_limit():.2f}</b>/day\nUsage: /setlimit &lt;dollars&gt;  e.g. /setlimit 3", parse_mode="html")
                return
            try:
                val = float(parts[1].replace("$", "").strip())
            except ValueError:
                await event.respond("❌ Not a number. Try /setlimit 3")
                return
            if val <= 0 or val > 10000:
                await event.respond("❌ Pick a value between 0 and 10000.")
                return
            await event.respond(set_spend_limit(val), parse_mode="html")

        elif text in ("/pending", "pending"):
            if not db:
                await event.respond("Firebase not connected.")
                return
            docs = list(db.collection("corpus_submissions").where("status", "==", "pending").stream())
            count = len(docs)
            if count == 0:
                await event.respond("✅ No pending entries — queue is clear!")
            else:
                await event.respond(f"⏳ <b>{count} entries</b> awaiting review.\nGo to Admin Portal to verify.", parse_mode="html")

        elif text in ("/next", "next"):
            if not db:
                await event.respond("Firebase not connected.")
                return
            docs = list(
                db.collection("corpus_submissions")
                .where("status", "==", "pending")
                .order_by("submitted_at")
                .limit(1)
                .stream()
            )
            if not docs:
                await event.respond("✅ No pending entries — queue is clear!")
                return
            d = docs[0]
            entry = d.to_dict()
            doc_id   = d.id
            last_pending_id = doc_id
            raw_text = entry.get("raw_text", "")
            source   = entry.get("source", "unknown")
            ratio    = entry.get("adlam_ratio", 0)
            words    = entry.get("word_count") or len(raw_text.strip().split())
            preview  = raw_text[:400] + ("…" if len(raw_text) > 400 else "")
            await event.respond(
                f"📋 <b>Next Pending Entry</b>\n\n"
                f"<code>{doc_id}</code>\n"
                f"📡 Source: {source}\n"
                f"🔤 ADLaM ratio: {ratio:.0%} | {words} words\n\n"
                f"{preview}\n\n"
                f"Reply /approve or /reject (no ID needed)",
                parse_mode="html",
            )

        elif text.startswith("/approve") or text.startswith("approve"):
            if not db:
                await event.respond("Firebase not connected.")
                return
            parts = raw_msg.split()
            if len(parts) >= 2:
                # strip everything except alphanumeric (removes backticks, invisible chars)
                doc_id = re.sub(r'[^a-zA-Z0-9]', '', parts[1])
            elif last_pending_id:
                doc_id = last_pending_id
            else:
                await event.respond("Usage: /approve <doc_id>\nOr send /next first then just /approve")
                return
            if not doc_id:
                await event.respond("❌ Couldn't parse doc ID. Send /next then just type /approve")
                return
            try:
                db.collection("corpus_submissions").document(doc_id).update({
                    "status": "verified",
                    "reviewed_by": "telegram_bot",
                    "reviewed_at": firestore.SERVER_TIMESTAMP,
                })
                last_pending_id = None
                await event.respond(f"✅ <b>Approved!</b>\n<code>{doc_id}</code>\nSend /next to review another.", parse_mode="html")
            except Exception as e:
                await event.respond(f"❌ Failed: {e}\nID used: <code>{doc_id}</code>", parse_mode="html")

        elif text.startswith("/reject") or text.startswith("reject"):
            if not db:
                await event.respond("Firebase not connected.")
                return
            parts = raw_msg.split()
            if len(parts) >= 2:
                doc_id = re.sub(r'[^a-zA-Z0-9]', '', parts[1])
            elif last_pending_id:
                doc_id = last_pending_id
            else:
                await event.respond("Usage: /reject <doc_id>\nOr send /next first then just /reject")
                return
            if not doc_id:
                await event.respond("❌ Couldn't parse doc ID. Send /next then just type /reject")
                return
            try:
                db.collection("corpus_submissions").document(doc_id).update({
                    "status": "rejected",
                    "reviewed_by": "telegram_bot",
                    "reviewed_at": firestore.SERVER_TIMESTAMP,
                })
                last_pending_id = None
                await event.respond(f"🗑 <b>Rejected.</b>\n<code>{doc_id}</code>\nSend /next to review another.", parse_mode="html")
            except Exception as e:
                await event.respond(f"❌ Failed: {e}\nID used: <code>{doc_id}</code>", parse_mode="html")

        elif text in ("/sync", "sync"):
            if sync_running:
                await event.respond("⚠️ Sync already running. Wait for it to finish.")
                return
            await event.respond("🔄 Starting sync… I'll message you when done.")
            loop = asyncio.get_event_loop()
            success, output = await loop.run_in_executor(None, run_sync)
            if success:
                await event.respond("✅ <b>Sync complete!</b>\nUse /status to see updated counts.", parse_mode="html")
            else:
                await event.respond(f"❌ <b>Sync failed.</b>\n<pre>{output[-500:]}</pre>", parse_mode="html")

        elif text.startswith("/ask") or (not text.startswith("/") and len(raw_msg) > 2):
            if not gemini_model:
                await event.respond("Gemini not configured. Set GEMINI_API_KEY env var.")
                return
            # Build context from Firestore
            context = ""
            if db:
                try:
                    docs = list(db.collection("corpus_submissions").stream())
                    total    = len(docs)
                    pending  = sum(1 for d in docs if d.to_dict().get("status") == "pending")
                    verified = sum(1 for d in docs if d.to_dict().get("status") == "verified")
                    rejected = sum(1 for d in docs if d.to_dict().get("status") == "rejected")
                    context = (
                        f"Gando AI corpus stats: {total} total entries, "
                        f"{verified} verified, {pending} pending review, {rejected} rejected. "
                        f"Sources: Telegram ADLaM groups + tabalde.com articles + PDF books. "
                        f"Goal: build ADLaM/Pulaar corpus for fine-tuning African language AI."
                    )
                except Exception:
                    context = "Gando AI corpus stats unavailable."

            question = raw_msg[5:].strip() if text.startswith("/ask") else raw_msg
            prompt = (
                f"You are the Gando AI assistant bot running on Telegram. "
                f"You help Abubakar manage his ADLaM/Pulaar corpus pipeline for Gando AI.\n\n"
                f"Current context: {context}\n\n"
                f"Answer this question concisely (under 200 words): {question}"
            )
            await event.respond("🤔 Thinking…")
            try:
                response = gemini_model.generate_content(prompt)
                await event.respond(response.text.strip())
            except Exception as e:
                await event.respond(f"❌ Gemini error: {e}")

        elif text.startswith("/note"):
            body = raw_msg[5:].strip()
            if not body:
                await event.respond("Usage: /note <your text>")
                return
            now = datetime.utcnow()
            timestamp = now.strftime("%Y-%m-%d %H:%M UTC")
            date_slug  = now.strftime("%Y-%m-%d-%H%M%S")
            filename   = f"01 - Inbox/{date_slug}-quick-note.md"
            md_content = f"---\ncreated: {timestamp}\nsource: telegram\n---\n\n{body}\n"
            await event.respond("📝 Saving to Obsidian inbox…")
            ok, result = push_to_github(filename, md_content, f"note: quick capture {date_slug}")
            if ok:
                await event.respond(f"✅ Note saved to Obsidian inbox.\n{result}")
            else:
                await event.respond(f"❌ GitHub push failed: {result}")

        elif text.startswith("/research"):
            topic = raw_msg[9:].strip()
            if not topic:
                await event.respond("Usage: /research <topic>")
                return
            if not gemini_model:
                await event.respond("Gemini not configured. Set GEMINI_API_KEY.")
                return
            await event.respond(f"🔍 Researching: {topic}…")
            prompt = (
                f"You are a research assistant for Abubakar Diallo, a CS student at NYU "
                f"building Gando AI — an African-language-first app builder focused on Fulani/Pulaar and ADLaM script.\n\n"
                f"Write a structured research note in Markdown about: {topic}\n\n"
                f"Format:\n"
                f"# {topic}\n\n"
                f"## Overview\n(3-4 sentences)\n\n"
                f"## Key Facts\n(bullet points)\n\n"
                f"## Relevance to ADLaM / Gando AI\n(how this connects to the project)\n\n"
                f"## Resources\n(list real URLs or sources if known)\n\n"
                f"## Next Steps\n(concrete action items)\n\n"
                f"Be accurate. Flag anything uncertain."
            )
            try:
                response = gemini_model.generate_content(prompt)
                note_md = response.text.strip()
                date_slug = datetime.utcnow().strftime("%Y-%m-%d")
                slug = re.sub(r"[^a-z0-9]+", "-", topic.lower())[:40]
                filename = f"03 - Areas/ADLaM Language/{date_slug}-{slug}.md"
                ok, result = push_to_github(filename, note_md, f"research: {topic[:60]}")
                if ok:
                    await event.respond(f"✅ Research note saved to Obsidian.\n{result}\n\nPreview:\n{note_md[:300]}…")
                else:
                    await event.respond(f"📄 Research done but GitHub push failed: {result}\n\n{note_md[:500]}")
            except Exception as e:
                await event.respond(f"❌ Gemini error: {e}")

        elif text.startswith("/add-term"):
            body = raw_msg[9:].strip()
            if "=" not in body:
                await event.respond("Usage: /add-term <adlam_word> = <english> [| domain]\nExample: /add-term 𞤼𞤮𞤩𞤭𞤪𞤣𞤫 = sync | data")
                return
            parts = body.split("=", 1)
            adlam_word = parts[0].strip()
            rest = parts[1].strip()
            domain = "general"
            if "|" in rest:
                latin_word, domain = [x.strip() for x in rest.split("|", 1)]
            else:
                latin_word = rest

            # Fetch current dict from GitHub
            dict_path = "adlam_dict.json"
            dict_url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{dict_path}"
            headers = {
                "Authorization": f"Bearer {GITHUB_TOKEN}",
                "Accept": "application/vnd.github+json",
            }
            try:
                req = urllib.request.Request(dict_url, headers=headers)
                with urllib.request.urlopen(req) as resp:
                    existing = json.loads(resp.read())
                    current_content = base64.b64decode(existing["content"]).decode("utf-8")
                    dict_data = json.loads(current_content)
            except Exception:
                # Dict not in GitHub yet — create fresh
                dict_data = {"_meta": {"description": "ADLaM technical dictionary"}, "terms": []}

            new_entry = {"adlam": adlam_word, "latin": latin_word, "domain": domain}
            dict_data["terms"].append(new_entry)
            dict_data["_meta"]["updated"] = datetime.utcnow().strftime("%Y-%m-%d")

            updated_json = json.dumps(dict_data, ensure_ascii=False, indent=2)
            ok, result = push_to_github(dict_path, updated_json, f"dict: add {latin_word}")
            if ok:
                await event.respond(f"✅ Term added to ADLaM dictionary!\n• {adlam_word} = {latin_word} [{domain}]\n{result}")
            else:
                await event.respond(f"❌ Failed to update dictionary: {result}")

        elif text.startswith("/corpus"):
            body = raw_msg[7:].strip()
            if not body:
                await event.respond("Usage: /corpus <ADLaM text to add>")
                return
            if not db:
                await event.respond("Firebase not connected.")
                return
            adlam_chars = sum(1 for c in body if 0x1E900 <= ord(c) <= 0x1E95F)
            ratio = adlam_chars / max(len(body), 1)
            if ratio < 0.3:
                await event.respond(f"⚠️ Low ADLaM ratio ({ratio:.0%}). Entry not saved. Make sure the text is in ADLaM script.")
                return
            try:
                db.collection("corpus_submissions").add({
                    "raw_text": body,
                    "source": "telegram_manual",
                    "adlam_ratio": ratio,
                    "word_count": len(body.split()),
                    "status": "pending",
                    "submitted_at": firestore.SERVER_TIMESTAMP,
                })
                await event.respond(f"✅ Corpus entry added!\nADLaM ratio: {ratio:.0%} | {len(body.split())} words\nStatus: pending review")
            except Exception as e:
                await event.respond(f"❌ Firestore error: {e}")

        elif text in ("/harvest", "harvest"):
            await event.respond("🔍 Manual harvest triggered — scraping sources now…")
            asyncio.create_task(run_harvest(client, reason="manual"))

        elif text in ("/groups", "groups"):
            await event.respond("📋 Listing the groups your account is in…")
            result = await list_user_groups()
            if result == "no_session":
                await event.respond("No user session set. Add TELEGRAM_SESSION (or TELEGRAM_USER_SESSION) in Railway first.")
            elif result == "unauth":
                await event.respond("Session invalid/expired. Generate a fresh user session and update TELEGRAM_SESSION.")
            elif not result:
                await event.respond("No groups found for this account.")
            else:
                header = "Your groups (copy the ADLaM ones into HARVEST_GROUPS, comma-separated):\n\n"
                chunk = header
                for line in result:
                    if len(chunk) + len(line) > 3500:
                        await event.respond(chunk)
                        chunk = ""
                    chunk += line + "\n"
                if chunk.strip():
                    await event.respond(chunk)

        else:
            await event.respond("Unknown command. Send /help to see available commands.")

    asyncio.create_task(harvest_scheduler(client))
    print(f"✓ Harvest scheduler armed — hours {HARVEST_HOURS} {HARVEST_TZ}; web {HARVEST_URLS}; groups {HARVEST_GROUPS or 'none'}")

    await client.run_until_disconnected()

if __name__ == "__main__":
    asyncio.run(main())
