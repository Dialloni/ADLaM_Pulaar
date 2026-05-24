# Gando AI — Telegram ADLaM Scraper

Scrapes ADLaM/Pulaar Telegram groups → JSONL corpus for fine-tuning.

## Setup

```bash
cd scraper
pip install -r requirements.txt
```

## Credentials

Get `api_id` and `api_hash` from https://my.telegram.org → "API development tools".

```bash
export TELEGRAM_API_ID=12345678
export TELEGRAM_API_HASH=your_hash_here
```

## Run

```bash
# Scrape all groups (first run will ask for phone + OTP to create .session file)
python scrape.py

# Merge all per-group files → single corpus.jsonl (deduped)
python merge.py

# Print stats
python stats.py
```

## Output

```
scraper/output/
├── defteadlam.jsonl
├── adlampular.jsonl
├── adlamadlam.jsonl
├── ...
└── corpus.jsonl          ← merged + deduped, ready for training
```

Each line is a JSON record:
```json
{
  "text": "𞤀𞤣𞤤𞤢𞤥 𞤼𞤫𞤳𞤪𞤫",
  "source": "defteadlam",
  "message_id": 12345,
  "date": "2024-03-15T10:22:00+00:00",
  "adlam_ratio": 0.94
}
```

## Filters

- `adlam_ratio >= 0.70` — drops messages with < 70% ADLaM characters
- Skips messages with no text (photos, stickers, etc.)

## Resume

State files (`.state_*.json`) track last scraped message ID per group.
Re-running `scrape.py` picks up from where it left off.
