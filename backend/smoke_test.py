"""
SPACES Style Concierge — Quick Smoke Test (no server needed for catalog tests)
Run this FIRST before starting the server to validate core logic.
Then start the server and run test_all.py for full API tests.
"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

PASS = "✅ PASS"
FAIL = "❌ FAIL"
results = []

def check(name, condition, detail=""):
    if condition:
        print(f"  {PASS}  {name}" + (f" — {detail}" if detail else ""))
        results.append((name, True))
    else:
        print(f"  {FAIL}  {name}" + (f" — {detail}" if detail else ""))
        results.append((name, False))

print("\n" + "="*60)
print("  SPACES POC — Smoke Tests (no server required)")
print("="*60)

# ── 1. Catalog loads ──────────────────────────────────────────────────────────
print("\n📦 Catalog Module")
try:
    from catalog import CATALOG, filter_catalog, catalog_to_prompt_text
    check("Catalog loads", True, f"{len(CATALOG)} products")
    check("Catalog not empty", len(CATALOG) > 0)
except Exception as e:
    check("Catalog loads", False, str(e))
    sys.exit(1)

# ── 2. Catalog schema validation ──────────────────────────────────────────────
print("\n📋 Schema Validation")
required_fields = ["sku","name","category","bedSize","fabricType","sleepTempRating",
                   "styleAesthetic","price","productUrl","thumbnailUrl","keyFeatures"]
for i, product in enumerate(CATALOG):
    for field in required_fields:
        check(f"Product {i+1} has field '{field}'", field in product, product.get("sku","?"))
    check(f"Product {i+1} price > 0", product["price"] > 0, f"₹{product['price']}")
    check(f"Product {i+1} URL valid", product["productUrl"].startswith("http"))
    check(f"Product {i+1} thumbnail valid", product["thumbnailUrl"].startswith("http"))

# ── 3. Filter tests ───────────────────────────────────────────────────────────
print("\n🔍 Filter Logic")

# King filter
king = filter_catalog(bed_size="King")
check("King filter returns results", len(king) > 0, f"{len(king)} products")
for p in king:
    check(f"  King in {p['sku']}.bedSize", "King" in p["bedSize"])

# Single filter
single = filter_catalog(bed_size="Single")
check("Single filter returns results", len(single) > 0, f"{len(single)} products")
for p in single:
    check(f"  Single in {p['sku']}.bedSize", "Single" in p["bedSize"])

# Queen filter
queen = filter_catalog(bed_size="Queen")
check("Queen filter returns results", len(queen) > 0, f"{len(queen)} products")

# Double filter
double = filter_catalog(bed_size="Double")
check("Double filter returns results", len(double) > 0, f"{len(double)} products")

# Bamboo filter
bamboo = filter_catalog(fabric="Bamboo")
check("Bamboo filter returns results", len(bamboo) > 0, f"{len(bamboo)} products")
for p in bamboo:
    check(f"  {p['sku']} fabric is Bamboo", p["fabricType"] == "Bamboo")

# Linen filter
linen = filter_catalog(fabric="Linen")
check("Linen filter returns results", len(linen) > 0, f"{len(linen)} products")

# Cool temp filter
cool = filter_catalog(sleep_temp="cool")
check("Cool temp filter returns results", len(cool) > 0, f"{len(cool)} products")

# Warm temp filter
warm = filter_catalog(sleep_temp="warm")
check("Warm temp filter returns results", len(warm) > 0, f"{len(warm)} products")

# Combined: King + cool + Cotton
combined = filter_catalog(bed_size="King", sleep_temp="cool", fabric="Cotton")
check("Combined filter (King+cool+Cotton) works", len(combined) > 0, f"{len(combined)} products")
check("Combined capped at 12", len(combined) <= 12)

# No preference — capped prompt subset by default
no_pref = filter_catalog()
check("No preference returns capped catalog subset", len(no_pref) == min(12, len(CATALOG)), f"{len(no_pref)} products")
no_pref_all = filter_catalog(max_results=len(CATALOG))
check("No preference can return full catalog when requested", len(no_pref_all) == len(CATALOG))

# ── 4. Prompt text generation ─────────────────────────────────────────────────
print("\n📝 Prompt Text Generation")
sample = CATALOG[:3]
prompt_text = catalog_to_prompt_text(sample)
check("Prompt text is non-empty", len(prompt_text) > 0)
check("Prompt text contains SKU", CATALOG[0]["sku"] in prompt_text)
check("Prompt text contains price", str(CATALOG[0]["price"]) in prompt_text)
check("Prompt text has correct line count", prompt_text.count("\n") == 2, f"{prompt_text.count('•')} bullets")

# ── 5. Models import ──────────────────────────────────────────────────────────
print("\n🧩 Pydantic Models")
try:
    from models import Preferences, RecommendRequest, RecommendResponse, ProductCard, ChatRequest, ChatResponse, ChatMessage
    check("All models import", True)

    # Validate Preferences
    p = Preferences(bedSize="King", sleepTemp="cool", fabric="Cotton", styleVibe="classic-whites")
    check("Preferences model valid", p.bedSize == "King")

    # Validate ProductCard
    card = ProductCard(
        sku="TEST-001", name="Test Sheet", thumbnail_url="https://example.com/img.jpg",
        product_url="https://spaces.in/test", price=2999, reason="Great for testing", confidence="high"
    )
    check("ProductCard model valid", card.price == 2999)
    check("ProductCard discounted_price defaults None", card.discounted_price is None)

    # Validate RecommendRequest
    rr = RecommendRequest(preferences=p)
    check("RecommendRequest valid", rr.preferences.bedSize == "King")

    # Validate ChatMessage
    cm = ChatMessage(role="user", content="Hello")
    check("ChatMessage valid", cm.role == "user")

except Exception as e:
    check("Models import/validate", False, str(e))

# ── 6. Prompts import ─────────────────────────────────────────────────────────
print("\n💬 Prompts")
try:
    from prompts import RECOMMENDATION_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT
    check("RECOMMENDATION_SYSTEM_PROMPT loads", len(RECOMMENDATION_SYSTEM_PROMPT) > 100)
    check("RECOMMENDATION_SYSTEM_PROMPT has {preferences} placeholder", "{preferences}" in RECOMMENDATION_SYSTEM_PROMPT)
    check("RECOMMENDATION_SYSTEM_PROMPT has {catalog} placeholder", "{catalog}" in RECOMMENDATION_SYSTEM_PROMPT)
    check("RECOMMENDATION_SYSTEM_PROMPT mentions JSON", "JSON" in RECOMMENDATION_SYSTEM_PROMPT)
    check("RECOMMENDATION_SYSTEM_PROMPT mentions 3 products", "3" in RECOMMENDATION_SYSTEM_PROMPT)

    check("CHAT_SYSTEM_PROMPT loads", len(CHAT_SYSTEM_PROMPT) > 100)
    check("CHAT_SYSTEM_PROMPT has {preferences} placeholder", "{preferences}" in CHAT_SYSTEM_PROMPT)
    check("CHAT_SYSTEM_PROMPT has {recommendations} placeholder", "{recommendations}" in CHAT_SYSTEM_PROMPT)
    check("CHAT_SYSTEM_PROMPT has {catalog} placeholder", "{catalog}" in CHAT_SYSTEM_PROMPT)
    check("CHAT_SYSTEM_PROMPT mentions return policy", "return" in CHAT_SYSTEM_PROMPT.lower())

    # Test .format() with sample data
    filled = RECOMMENDATION_SYSTEM_PROMPT.format(
        preferences="Bed Size: King\nSleep Temperature: cool\nFabric Preference: Cotton\nStyle Vibe: classic-whites",
        catalog=catalog_to_prompt_text(CATALOG[:5])
    )
    check("RECOMMENDATION_SYSTEM_PROMPT .format() works", "King" in filled and len(filled) > 500)

    filled_chat = CHAT_SYSTEM_PROMPT.format(
        preferences="Bed Size: King",
        recommendations="• Test Product (SKU: T-001) — ₹2999",
        catalog=catalog_to_prompt_text(CATALOG[:3])
    )
    check("CHAT_SYSTEM_PROMPT .format() works", "King" in filled_chat)

except Exception as e:
    check("Prompts import/format", False, str(e))

# ── 7. .env file exists ───────────────────────────────────────────────────────
print("\n🔑 Environment")
env_path = os.path.join(os.path.dirname(__file__), ".env")
check(".env file exists", os.path.exists(env_path))
if os.path.exists(env_path):
    with open(env_path) as f:
        env_content = f.read()
    check("OPENROUTER_API_KEY in .env", "OPENROUTER_API_KEY" in env_content)
    key_line = [l for l in env_content.splitlines() if l.startswith("OPENROUTER_API_KEY=")]
    if key_line:
        key_val = key_line[0].split("=", 1)[1].strip()
        check("Key is not placeholder", "your-key" not in key_val and len(key_val) > 10, f"key starts with: {key_val[:12]}...")

# ── 8. Widget files exist ─────────────────────────────────────────────────────
print("\n🖥️  Frontend Files")
widget_dir = os.path.join(os.path.dirname(__file__), "..", "widget")
check("widget/ directory exists", os.path.isdir(widget_dir))
check("spaces-widget.js exists", os.path.isfile(os.path.join(widget_dir, "spaces-widget.js")))
check("widget-demo.html exists", os.path.isfile(os.path.join(widget_dir, "widget-demo.html")))

js_path = os.path.join(widget_dir, "spaces-widget.js")
if os.path.isfile(js_path):
    with open(js_path, encoding="utf-8") as f:
        js = f.read()
    check("Widget contains shadow DOM", "attachShadow" in js)
    check("Widget contains state machine", "state.stage" in js)
    check("Widget has 4 questions", js.count('key:') >= 4 or js.count('"key":') >= 4)
    check("Widget calls /api/recommend", "/api/recommend" in js)
    check("Widget calls /api/chat", "/api/chat" in js)
    check("Widget has product card renderer", "renderProductCards" in js)
    check("Widget has typing indicator", "showTyping" in js)
    check("Widget has error handling", "addError" in js)
    check("Widget has SPACES brand colors", "#C9784A" in js)
    check("Widget uses Cormorant Garamond font", "Cormorant Garamond" in js)

html_path = os.path.join(widget_dir, "widget-demo.html")
if os.path.isfile(html_path):
    with open(html_path, encoding="utf-8") as f:
        html = f.read()
    check("Demo page has widget script tag", "spaces-widget.js" in html)
    check("Demo page has data-api-url", "data-api-url" in html)
    check("Demo page has SPACES branding", "SPACES" in html)
    check("Demo page has product grid", "product-grid" in html)
    check("Demo page is valid HTML5", "<!DOCTYPE html>" in html)

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "="*60)
passed = sum(1 for _, ok in results if ok)
total = len(results)
pct = int(passed/total*100) if total else 0
print(f"  SMOKE TEST RESULTS: {passed}/{total} passed ({pct}%)")
print()
for name, ok in results:
    icon = "✅" if ok else "❌"
    print(f"  {icon} {name}")
print("="*60)
if passed == total:
    print("\n  🎉 All smoke tests passed! Ready to start server.")
    print("     Run: uvicorn main:app --reload")
    print("     Then: python test_all.py  (for full API tests)")
else:
    failed = [(n, ok) for n, ok in results if not ok]
    print(f"\n  ⚠️  {len(failed)} test(s) failed. Fix before starting server.")
print()
sys.exit(0 if passed == total else 1)
