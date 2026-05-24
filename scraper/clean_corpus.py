"""
Strip emojis from existing corpus.jsonl and re-save.
Run once to clean already-scraped data.
SAFE: explicitly excludes ADLaM block (U+1E900–U+1E95F).
"""

import json
import re
from pathlib import Path

# Safe emoji regex — split around ADLaM block (U+1E900–U+1E95F)
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

corpus = Path("output/corpus.jsonl")
cleaned_path = Path("output/corpus_clean.jsonl")

total, changed, dropped = 0, 0, 0

with open(cleaned_path, "w", encoding="utf-8") as out:
    for line in corpus.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rec = json.loads(line)
        total += 1
        clean = strip_emoji(rec["text"])
        if not clean:
            dropped += 1
            continue
        if clean != rec["text"]:
            changed += 1
        rec["text"] = clean
        out.write(json.dumps(rec, ensure_ascii=False) + "\n")

print(f"✓ {total} records processed")
print(f"  {changed} had emojis removed")
print(f"  {dropped} dropped (emoji-only messages)")
print(f"  Output: {cleaned_path.resolve()}")
