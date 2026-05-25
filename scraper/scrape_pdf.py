"""
Gando AI — PDF Corpus Scraper
Extracts ADLaM text from PDFs that use pre-Unicode font encoding.

Pipeline:
  1. Extract text per page with PyMuPDF
  2. Send to Gemini to decode Arabic-encoded ADLaM → real Unicode ADLaM
  3. Apply ADLaM ratio filter (>= 0.50)
  4. Save to output/pdf_corpus.jsonl

Usage: python scrape_pdf.py
"""

import json
import os
import re
import time
from pathlib import Path

import fitz  # pymupdf
import google.generativeai as genai

# ── CONFIG ────────────────────────────────────────────────────────────────────

GEMINI_API_KEY  = os.environ.get("GEMINI_API_KEY", "")
OUTPUT_DIR      = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)
OUTPUT_FILE     = OUTPUT_DIR / "pdf_corpus.jsonl"
ADLAM_MIN_RATIO = 0.50
DELAY           = 1.5   # seconds between Gemini calls

PDFS = [
    "/Users/abubakardiallo/Desktop/deftere adlam aarabu e latin .pdf",
    "/Users/abubakardiallo/Desktop/BA TAMMERE N'DEN .pdf",
    "/Users/abubakardiallo/Desktop/Kijooje dhen.pdf",
]

DECODE_PROMPT = """You are a Unicode expert for the ADLaM script (Fulani/Pulaar language).

The following text was extracted from a PDF that used a pre-Unicode ADLaM font. In these fonts, ADLaM glyphs were mapped to Arabic Unicode codepoints (U+0600–U+06FF) instead of the official ADLaM Unicode block (U+1E900–U+1E95F).

Your task: re-encode this text so every character uses the correct ADLaM Unicode block (U+1E900–U+1E95F). The language is Fulani/Pulaar.

Rules:
- Map each Arabic character to its phonetically equivalent ADLaM character
- Preserve spaces, punctuation, and line breaks exactly
- Output ONLY the re-encoded ADLaM Unicode text — no explanation, no transliteration, no Latin
- If a line is clearly Latin/French (not ADLaM), skip it entirely

Input text:
{text}"""

# ── HELPERS ───────────────────────────────────────────────────────────────────

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
        if line:
            rec = json.loads(line)
            seen.add(f"{rec['source']}:{rec['message_id']}")
    return seen

def decode_page(model, raw_text: str) -> str:
    """Send pre-Unicode ADLaM text to Gemini, get real Unicode ADLaM back."""
    if not raw_text.strip():
        return ""
    prompt = DECODE_PROMPT.format(text=raw_text)
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"    ✗ Gemini error: {e}")
        return ""

# ── SCRAPER ───────────────────────────────────────────────────────────────────

def scrape_pdf(model, pdf_path: str, existing: set) -> int:
    path = Path(pdf_path)
    source = path.stem
    print(f"\n{'─'*60}")
    print(f"  PDF : {path.name}")

    if not path.exists():
        print("  ✗ File not found")
        return 0

    doc = fitz.open(str(path))
    print(f"  Pages: {len(doc)}")

    saved = 0
    skipped = 0

    with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
        for page_num in range(len(doc)):
            page_id = f"p{page_num+1}"
            key = f"{source}:{page_id}"

            if key in existing:
                skipped += 1
                continue

            raw_text = doc[page_num].get_text().strip()
            if not raw_text:
                skipped += 1
                continue

            print(f"  Decoding page {page_num+1}/{len(doc)}…", end=" ", flush=True)
            decoded = decode_page(model, raw_text)

            if not decoded:
                print("empty")
                skipped += 1
                time.sleep(DELAY)
                continue

            ratio = adlam_ratio(decoded)
            if ratio < ADLAM_MIN_RATIO:
                print(f"ratio={ratio:.0%} (skipped)")
                skipped += 1
                time.sleep(DELAY)
                continue

            record = {
                "text":        decoded,
                "source":      source,
                "message_id":  page_id,
                "date":        "",
                "adlam_ratio": round(ratio, 4),
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
            existing.add(key)
            saved += 1
            print(f"✓ ratio={ratio:.0%}")
            time.sleep(DELAY)

    print(f"  ✓ Done — {saved} saved, {skipped} skipped")
    return saved

# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    if not GEMINI_API_KEY:
        raise SystemExit("Set GEMINI_API_KEY env var")

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash")

    print("Gando AI — PDF Scraper")
    existing = load_existing(OUTPUT_FILE)
    print(f"Existing PDF corpus: {len(existing)} entries")

    total = 0
    for pdf_path in PDFS:
        total += scrape_pdf(model, pdf_path, existing)

    print(f"\n✓ Total new PDF entries: {total}")
    print(f"  Output: {OUTPUT_FILE.resolve()}")

if __name__ == "__main__":
    main()
