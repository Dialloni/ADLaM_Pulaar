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
from datetime import datetime

import urllib.request
import urllib.error

try:
    import google.generativeai as genai
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel("gemini-2.5-flash")
    else:
        gemini_model = None
except ImportError:
    gemini_model = None

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

sync_running = False
last_pending_id = None  # track last /next result for quick approve/reject

# ── GITHUB PUSH ───────────────────────────────────────────────────────────────

def push_to_github(file_path: str, content: str, commit_msg: str) -> tuple[bool, str]:
    """Push a file to the gando-brain GitHub repo via REST API."""
    if not GITHUB_TOKEN or not GITHUB_REPO:
        return False, "GITHUB_TOKEN or GITHUB_REPO not set in env vars."
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{file_path}"
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

# ── BOT ───────────────────────────────────────────────────────────────────────

async def main():
    # Bot uses bot_token auth — no user session needed (StringSession("") = fresh bot session)
    client = TelegramClient(StringSession(""), API_ID, API_HASH)
    await client.start(bot_token=BOT_TOKEN)
    print(f"✓ Gando bot running. Listening for commands from chat {CHAT_ID}...")

    @client.on(events.NewMessage(chats=CHAT_ID))
    async def handler(event):
        global sync_running, last_pending_id
        raw_msg = event.message.text.strip()
        text = raw_msg.lower()

        if text in ("/start", "start"):
            await event.respond(
                "𞤘𞤢𞤲𞤣𞤮 AI Bot 🤖\n\n"
                "Commands:\n"
                "/status — corpus stats\n"
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
                "/ask &lt;question&gt; — ask Gemini anything",
                parse_mode="html"
            )

        elif text in ("/status", "status"):
            await event.respond("Fetching stats…")
            stats = get_corpus_stats()
            await event.respond(stats, parse_mode="html")

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
            timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
            date_slug  = datetime.utcnow().strftime("%Y-%m-%d")
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

        else:
            await event.respond("Unknown command. Send /help to see available commands.")

    await client.run_until_disconnected()

if __name__ == "__main__":
    asyncio.run(main())
