"""
Merge all per-group JSONL files → single corpus.jsonl
Deduplicates by (source, message_id).
"""

import json
from pathlib import Path

OUTPUT_DIR = Path("output")
CORPUS     = OUTPUT_DIR / "corpus.jsonl"

seen   = set()
total  = 0
dupes  = 0

with open(CORPUS, "w", encoding="utf-8") as out:
    for f in sorted(OUTPUT_DIR.glob("*.jsonl")):
        if f.name == "corpus.jsonl":
            continue
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            key = (rec["source"], rec["message_id"])
            if key in seen:
                dupes += 1
                continue
            seen.add(key)
            out.write(line + "\n")
            total += 1

print(f"✓ corpus.jsonl — {total} records ({dupes} dupes removed)")
print(f"  Saved to: {CORPUS.resolve()}")
