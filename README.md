# SPACES Style Concierge — AI Shopping Assistant POC

An AI-powered bedding recommendation widget for [SPACES](https://spaces.in), built with **FastAPI + Claude + Vanilla JS**.

---

## Project Structure

```
poc_d2c/
├── backend/
│   ├── main.py              ← FastAPI app (3 endpoints)
│   ├── models.py            ← Pydantic schemas
│   ├── catalog.py           ← Catalog loader + filter helper
│   ├── prompts.py           ← System prompts (highest-leverage file)
│   ├── requirements.txt     ← Python deps
│   ├── .env.example         ← Copy → .env and add API key
│   └── data/
│       └── spaces_catalog.json   ← 15 SKU sample catalog
└── widget/
    ├── spaces-widget.js     ← Drop-in embeddable widget
    └── widget-demo.html     ← Standalone demo page
```

---

## Quick Start

### 1. Backend

```bash
cd poc_d2c/backend

# Install dependencies
pip install -r requirements.txt

# Add your API key
copy .env.example .env
# Edit .env and set: ANTHROPIC_API_KEY=sk-ant-...

# Start the server
uvicorn main:app --reload
```

The API will be live at `http://localhost:8000`.
- `GET  /api/health` — check catalog size and AI status
- `POST /api/recommend` — get 3 AI-matched products
- `POST /api/chat` — follow-up conversation

> **No API key?** The widget still works in demo mode — it returns mock product cards through Stage 1 & 2.

### 2. Frontend Demo

Simply open `widget/widget-demo.html` in your browser (double-click or drag into Chrome).

The widget is embedded via a single script tag:
```html
<script src="spaces-widget.js" data-api-url="http://localhost:8000"></script>
```

---

## How It Works

| Stage | What happens | AI involved? |
|-------|-------------|-------------|
| **1 — Intake** | 4 quick-reply chip questions | ❌ Pure JS |
| **2 — Match** | Preferences + filtered catalog → 3 product cards | ✅ 1 Claude call |
| **3 — Chat** | Open conversation with context | ✅ Claude per message |

The catalog is pre-filtered by bed size (hard filter) before sending to Claude, keeping the prompt token-lean.

---

## Embedding on a Real Page

```html
<!-- Add just before </body> on any SPACES page -->
<script
  src="https://your-cdn.com/spaces-widget.js"
  data-api-url="https://your-backend.com"
></script>
```

The widget uses **Shadow DOM** — zero CSS bleed into the host page.

---

## Extending the Catalog

Replace `data/spaces_catalog.json` with a real export. Each product must have:

```json
{
  "sku": "SPC-KG-HYGRO-001",
  "name": "...",
  "category": "Bedsheet",
  "bedSize": ["King"],
  "fabricType": "Hygro Cotton",
  "sleepTempRating": "cool",
  "styleAesthetic": ["classic-whites"],
  "price": 3499,
  "discountedPrice": 2799,
  "productUrl": "https://spaces.in/products/...",
  "thumbnailUrl": "https://...",
  "keyFeatures": ["..."]
}
```

---

## Notes for Demo

1. Open `widget-demo.html` in Chrome
2. Click the coral chat bubble (bottom right)
3. Answer 4 questions using the chips
4. See 3 AI-matched product cards appear
5. Type "show me something warmer" — follow-up uses full context
6. Type "what's your return policy?" — handles FAQs gracefully

---

*Built by MSC Consultancy as a 2-week POC for SPACES India.*
