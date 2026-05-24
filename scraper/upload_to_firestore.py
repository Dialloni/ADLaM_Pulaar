"""
Upload corpus.jsonl → Firestore corpus_entries collection.
Each entry saved with status='pending' for admin review.

Requirements:
  pip install firebase-admin

Usage:
  export FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
  python upload_to_firestore.py [--file output/corpus.jsonl] [--batch 400]
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    sys.exit("Run: pip install firebase-admin")

# ── ARGS ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser()
parser.add_argument("--file",  default="output/corpus.jsonl", help="JSONL file to upload")
parser.add_argument("--batch", type=int, default=400, help="Firestore batch size (max 500)")
parser.add_argument("--db",         default="(default)",        help="Firestore database ID")
parser.add_argument("--collection", default="corpus_submissions", help="Firestore collection name")
args = parser.parse_args()

CORPUS_FILE = Path(args.file)
BATCH_SIZE  = min(args.batch, 499)

# ── FIREBASE INIT ─────────────────────────────────────────────────────────────

raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY", "")
if not raw:
    sys.exit("Set FIREBASE_SERVICE_ACCOUNT_KEY env var (JSON string from Firebase Console)")

if not firebase_admin._apps:
    cred = credentials.Certificate(json.loads(raw))
    firebase_admin.initialize_app(cred)

db = firestore.client(database_id=args.db)

# ── DEDUP CHECK ───────────────────────────────────────────────────────────────

print("Fetching existing message IDs from Firestore (dedup check)…")
existing = set()
for doc in db.collection(args.collection).stream():
    d = doc.to_dict()
    key = f"{d.get('source','')}:{d.get('message_id','')}"
    existing.add(key)
print(f"  {len(existing)} existing entries found")

# ── LOAD CORPUS ───────────────────────────────────────────────────────────────

if not CORPUS_FILE.exists():
    sys.exit(f"File not found: {CORPUS_FILE}")

records = []
for line in CORPUS_FILE.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line:
        continue
    rec = json.loads(line)
    key = f"{rec['source']}:{rec['message_id']}"
    if key not in existing:
        records.append(rec)

print(f"  {len(records)} new records to upload ({len(existing)} already in DB)")

if not records:
    print("Nothing to upload.")
    sys.exit(0)

# ── UPLOAD IN BATCHES ─────────────────────────────────────────────────────────

total    = 0
col_ref  = db.collection(args.collection)

for i in range(0, len(records), BATCH_SIZE):
    chunk = records[i : i + BATCH_SIZE]
    batch = db.batch()
    for rec in chunk:
        doc_ref = col_ref.document()
        batch.set(doc_ref, {
            "raw_text":    rec["text"],
            "source":      f"telegram:{rec['source']}",
            "message_id":  rec["message_id"],
            "date":        rec["date"],
            "adlam_ratio": rec["adlam_ratio"],
            "status":      "pending",
            "domain":      None,
            "submitted_at": firestore.SERVER_TIMESTAMP,
            "source_meta": {
                "submitted_by":   "scraper",
                "needs_decoding": False,
                "message_id":     rec["message_id"],
            },
        })
    batch.commit()
    total += len(chunk)
    print(f"  Uploaded {total}/{len(records)}…")
    time.sleep(0.5)   # avoid Firestore rate limits

print(f"\n✓ Done — {total} entries uploaded to {args.collection} (status=pending)")
print("  Go to Admin Portal → Review Queue to verify them.")
