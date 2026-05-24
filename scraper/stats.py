"""
Print corpus statistics — total messages, per-group breakdown, avg ADLaM ratio.
"""

import json
from collections import defaultdict
from pathlib import Path

OUTPUT_DIR = Path("output")

files = sorted(f for f in OUTPUT_DIR.glob("*.jsonl") if f.name != "corpus.jsonl")

if not files:
    print("No .jsonl files found in output/. Run scrape.py first.")
    raise SystemExit

grand_total = 0
grand_chars = 0

for f in files:
    lines  = [json.loads(l) for l in f.read_text().splitlines() if l.strip()]
    count  = len(lines)
    ratios = [r["adlam_ratio"] for r in lines]
    chars  = sum(len(r["text"]) for r in lines)
    avg    = sum(ratios) / len(ratios) if ratios else 0
    grand_total += count
    grand_chars += chars
    print(f"  {f.stem:<35} {count:>6} msgs   avg ratio {avg:.2f}   {chars:>8} chars")

print(f"\n  {'TOTAL':<35} {grand_total:>6} msgs   {grand_chars:>8} chars")

corpus = OUTPUT_DIR / "corpus.jsonl"
if corpus.exists():
    merged = sum(1 for l in corpus.read_text().splitlines() if l.strip())
    print(f"  corpus.jsonl (merged+deduped):    {merged:>6} msgs")
