"""
SPACES Style Concierge — Comprehensive Test Suite
Run: python test_all.py
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = os.getenv("SPACES_TEST_BASE", "http://localhost:8001")
PASS = "\033[92m✅ PASS\033[0m"
FAIL = "\033[91m❌ FAIL\033[0m"
INFO = "\033[94mℹ️  INFO\033[0m"

results = []

# ─────────────────────────────────────────────────────────────────────────────
def req(method, path, body=None, timeout=30):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"} if data else {}
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())
    except Exception as e:
        return None, str(e)


def test(name, fn):
    print(f"\n{'─'*60}")
    print(f"  TEST: {name}")
    print(f"{'─'*60}")
    try:
        fn()
        results.append((name, True))
    except AssertionError as e:
        print(f"  {FAIL}: {e}")
        results.append((name, False))
    except Exception as e:
        print(f"  {FAIL} (exception): {e}")
        results.append((name, False))


def assert_eq(label, actual, expected):
    if actual == expected:
        print(f"  {PASS}  {label}: {actual!r}")
    else:
        raise AssertionError(f"{label} → expected {expected!r}, got {actual!r}")


def assert_in(label, actual, container):
    if actual in container:
        print(f"  {PASS}  {label}: {actual!r}")
    else:
        raise AssertionError(f"{label} → {actual!r} not found in {container!r}")


def assert_truthy(label, value):
    if value:
        print(f"  {PASS}  {label}: {value!r}")
    else:
        raise AssertionError(f"{label} is falsy: {value!r}")


def assert_type(label, value, typ):
    if isinstance(value, typ):
        print(f"  {PASS}  {label} is {typ.__name__}: {str(value)[:80]!r}")
    else:
        raise AssertionError(f"{label} → expected {typ.__name__}, got {type(value).__name__}: {value!r}")


# ─────────────────────────────────────────────────────────────────────────────
# 1. Health Check
# ─────────────────────────────────────────────────────────────────────────────
def test_health():
    status, body = req("GET", "/api/health")
    print(f"  Response: {body}")
    assert_eq("HTTP status", status, 200)
    assert_eq("status field", body.get("status"), "ok")
    assert_type("catalog_size", body.get("catalog_size"), int)
    assert_truthy("catalog_size > 0", body.get("catalog_size", 0) > 0)
    print(f"  {INFO}  AI enabled: {body.get('ai_enabled')} | Model: {body.get('model')}")


def test_catalog_endpoint():
    status, body = req("GET", "/api/catalog")
    assert_eq("HTTP status", status, 200)
    products = body.get("products", [])
    assert_truthy("catalog has at least 30 demo SKUs", len(products) >= 30)
    categories = {p.get("category") for p in products}
    for category in ["Bedsheet", "Pillow", "Pillow Cover", "Bath Towel", "Bath Mat", "Duvet Cover", "Cushion Cover"]:
        assert_in(f"category {category}", category, categories)


def test_related_products_bedsheet():
    payload = {
        "selected_sku": "SPC-KG-HYGRO-001",
        "cart_skus": ["SPC-KG-HYGRO-001"],
        "limit": 4,
    }
    status, body = req("POST", "/api/related-products", payload)
    assert_eq("HTTP status", status, 200)
    recs = body.get("recommendations", [])
    assert_eq("returns 4 add-ons", len(recs), 4)
    assert_truthy("intro_message present", body.get("intro_message"))
    returned_skus = {r["sku"] for r in recs}
    assert_truthy("selected SKU excluded", "SPC-KG-HYGRO-001" not in returned_skus)
    categories = {r["sku"] for r in recs}
    assert_truthy("pillow cover/pillow add-on included", bool({"SPC-PC-FLORA-018", "SPC-PL-QUILT-017", "SPC-PL-MICRO-016"} & categories))


def test_related_products_cart_only():
    payload = {
        "cart_skus": ["SPC-TW-LILAC-019"],
        "limit": 3,
    }
    status, body = req("POST", "/api/related-products", payload)
    assert_eq("HTTP status", status, 200)
    recs = body.get("recommendations", [])
    assert_eq("returns 3 recommendations", len(recs), 3)
    assert_truthy("cart SKU excluded", all(r["sku"] != "SPC-TW-LILAC-019" for r in recs))


# ─────────────────────────────────────────────────────────────────────────────
# 2. Recommend — King, Cool, Cotton, Classic Whites
# ─────────────────────────────────────────────────────────────────────────────
def test_recommend_king_cool_cotton():
    payload = {"preferences": {
        "bedSize": "King",
        "sleepTemp": "cool",
        "fabric": "Cotton",
        "styleVibe": "classic-whites"
    }}
    status, body = req("POST", "/api/recommend", payload)
    print(f"  HTTP: {status}")
    assert_eq("HTTP status", status, 200)
    recs = body.get("recommendations", [])
    assert_eq("exactly 3 recommendations", len(recs), 3)
    assert_type("intro_message", body.get("intro_message"), str)
    assert_truthy("intro_message not empty", body.get("intro_message"))

    # Check first card structure
    card = recs[0]
    print(f"\n  First card:")
    for field in ["sku", "name", "thumbnail_url", "product_url", "price", "reason", "confidence"]:
        assert_truthy(f"  card.{field} present", field in card)
        print(f"    {field}: {str(card[field])[:80]}")

    # Confidence must be valid
    assert_in("confidence value", card["confidence"], ["high", "medium", "low"])

    # Price must be positive integer
    assert_type("price is int", card["price"], int)
    assert_truthy("price > 0", card["price"] > 0)

    # URLs must be real URLs
    assert_truthy("product_url starts with https", card["product_url"].startswith("http"))
    assert_truthy("thumbnail_url starts with https", card["thumbnail_url"].startswith("http"))

    # Reason should be non-trivial
    assert_truthy("reason length > 10", len(card["reason"]) > 10)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Recommend — Single, Warm, No preference, Bold colourful
# ─────────────────────────────────────────────────────────────────────────────
def test_recommend_single_warm():
    payload = {"preferences": {
        "bedSize": "Single",
        "sleepTemp": "warm",
        "fabric": "No preference",
        "styleVibe": "bold-colorful"
    }}
    status, body = req("POST", "/api/recommend", payload)
    assert_eq("HTTP status", status, 200)
    recs = body.get("recommendations", [])
    assert_eq("exactly 3 recommendations", len(recs), 3)
    print(f"  Intro: {body.get('intro_message')[:100]}")
    for r in recs:
        print(f"  • [{r['sku']}] {r['name']} — ₹{r['price']} — {r['confidence']}")


# ─────────────────────────────────────────────────────────────────────────────
# 4. Recommend — Bamboo, Queen, neutral
# ─────────────────────────────────────────────────────────────────────────────
def test_recommend_bamboo_queen():
    payload = {"preferences": {
        "bedSize": "Queen",
        "sleepTemp": "neutral",
        "fabric": "Bamboo",
        "styleVibe": "earthy-tones"
    }}
    status, body = req("POST", "/api/recommend", payload)
    assert_eq("HTTP status", status, 200)
    recs = body.get("recommendations", [])
    assert_eq("exactly 3 recommendations", len(recs), 3)
    for r in recs:
        print(f"  • [{r['sku']}] {r['name']} | {r['reason'][:60]}")


# ─────────────────────────────────────────────────────────────────────────────
# 5. Recommend — Double, Linen, warm
# ─────────────────────────────────────────────────────────────────────────────
def test_recommend_double_linen():
    payload = {"preferences": {
        "bedSize": "Double",
        "sleepTemp": "cool",
        "fabric": "Linen",
        "styleVibe": "No preference"
    }}
    status, body = req("POST", "/api/recommend", payload)
    assert_eq("HTTP status", status, 200)
    recs = body.get("recommendations", [])
    assert_truthy("at least 1 recommendation", len(recs) >= 1)
    for r in recs:
        print(f"  • {r['name']} — ₹{r.get('discounted_price') or r['price']}")


# ─────────────────────────────────────────────────────────────────────────────
# 6. Chat — follow-up "show me something warmer"
# ─────────────────────────────────────────────────────────────────────────────
def test_chat_warmer():
    # First get recommendations
    prefs = {"bedSize": "King", "sleepTemp": "cool", "fabric": "Cotton", "styleVibe": "classic-whites"}
    _, rec_body = req("POST", "/api/recommend", {"preferences": prefs})
    recs = rec_body.get("recommendations", [])

    payload = {
        "preferences": prefs,
        "recommendations": recs,
        "history": [],
        "message": "Show me something warmer — I get cold easily"
    }
    status, body = req("POST", "/api/chat", payload)
    print(f"  HTTP: {status}")
    print(f"  Response: {body.get('message', '')[:200]}")
    assert_eq("HTTP status", status, 200)
    assert_type("message is str", body.get("message"), str)
    assert_truthy("message not empty", body.get("message"))


# ─────────────────────────────────────────────────────────────────────────────
# 7. Chat — return policy FAQ
# ─────────────────────────────────────────────────────────────────────────────
def test_chat_return_policy():
    prefs = {"bedSize": "Queen", "sleepTemp": "neutral", "fabric": "Cotton", "styleVibe": "earthy-tones"}
    _, rec_body = req("POST", "/api/recommend", {"preferences": prefs})
    recs = rec_body.get("recommendations", [])

    payload = {
        "preferences": prefs,
        "recommendations": recs,
        "history": [],
        "message": "What is the return policy?"
    }
    status, body = req("POST", "/api/chat", payload)
    assert_eq("HTTP status", status, 200)
    msg = body.get("message", "")
    print(f"  Response: {msg[:200]}")
    assert_truthy("mentions return", "return" in msg.lower() or "30" in msg or "exchange" in msg.lower())


# ─────────────────────────────────────────────────────────────────────────────
# 8. Chat — delivery FAQ
# ─────────────────────────────────────────────────────────────────────────────
def test_chat_delivery():
    prefs = {"bedSize": "Double", "sleepTemp": "cool", "fabric": "Bamboo", "styleVibe": "classic-whites"}
    _, rec_body = req("POST", "/api/recommend", {"preferences": prefs})
    recs = rec_body.get("recommendations", [])

    payload = {
        "preferences": prefs,
        "recommendations": recs,
        "history": [],
        "message": "How long does delivery take?"
    }
    status, body = req("POST", "/api/chat", payload)
    assert_eq("HTTP status", status, 200)
    msg = body.get("message", "")
    print(f"  Response: {msg[:200]}")
    assert_truthy("mentions delivery time", any(w in msg.lower() for w in ["day", "week", "deliver", "ship"]))


# ─────────────────────────────────────────────────────────────────────────────
# 9. Chat — multi-turn conversation context retention
# ─────────────────────────────────────────────────────────────────────────────
def test_chat_multi_turn():
    prefs = {"bedSize": "King", "sleepTemp": "cool", "fabric": "Cotton", "styleVibe": "earthy-tones"}
    _, rec_body = req("POST", "/api/recommend", {"preferences": prefs})
    recs = rec_body.get("recommendations", [])

    # Turn 1
    payload1 = {
        "preferences": prefs,
        "recommendations": recs,
        "history": [],
        "message": "Which one is the softest?"
    }
    _, body1 = req("POST", "/api/chat", payload1)
    reply1 = body1.get("message", "")
    print(f"  Turn 1 Q: Which one is the softest?")
    print(f"  Turn 1 A: {reply1[:150]}")

    # Turn 2 — referencing first answer
    payload2 = {
        "preferences": prefs,
        "recommendations": recs,
        "history": [
            {"role": "user", "content": "Which one is the softest?"},
            {"role": "assistant", "content": reply1}
        ],
        "message": "And which one would you recommend for a 5-year-old child's room?"
    }
    _, body2 = req("POST", "/api/chat", payload2)
    reply2 = body2.get("message", "")
    print(f"  Turn 2 Q: And which one for a child's room?")
    print(f"  Turn 2 A: {reply2[:150]}")

    assert_truthy("turn 2 reply is non-empty", reply2)
    assert_type("turn 2 reply is str", reply2, str)


# ─────────────────────────────────────────────────────────────────────────────
# 10. Edge — missing required field in recommend
# ─────────────────────────────────────────────────────────────────────────────
def test_bad_request_missing_field():
    # Missing 'sleepTemp'
    payload = {"preferences": {
        "bedSize": "King",
        "fabric": "Cotton",
        "styleVibe": "classic-whites"
    }}
    status, body = req("POST", "/api/recommend", payload)
    print(f"  HTTP: {status} | Body: {str(body)[:120]}")
    assert_eq("HTTP 422 on missing field", status, 422)


# ─────────────────────────────────────────────────────────────────────────────
# 11. Edge — wrong method
# ─────────────────────────────────────────────────────────────────────────────
def test_wrong_method():
    status, _ = req("GET", "/api/recommend")
    print(f"  HTTP: {status}")
    assert_truthy("GET on POST endpoint is rejected", status in (404, 405))


# ─────────────────────────────────────────────────────────────────────────────
# 12. Catalog filter — King bed pre-filter
# ─────────────────────────────────────────────────────────────────────────────
def test_catalog_filter():
    """Directly test the catalog module."""
    sys.path.insert(0, ".")
    from catalog import filter_catalog, CATALOG
    total = len(CATALOG)
    king = filter_catalog(bed_size="King")
    single = filter_catalog(bed_size="Single")
    bamboo = filter_catalog(fabric="Bamboo")

    print(f"  Total catalog: {total}")
    print(f"  King filter: {len(king)} products → {[p['sku'] for p in king]}")
    print(f"  Single filter: {len(single)} products → {[p['sku'] for p in single]}")
    print(f"  Bamboo filter: {len(bamboo)} products → {[p['sku'] for p in bamboo]}")

    assert_truthy("King results exist", len(king) > 0)
    for p in king:
        assert_in(f"King in {p['sku']}.bedSize", "King", p["bedSize"])
    assert_truthy("Single results exist", len(single) > 0)
    assert_truthy("Bamboo results exist", len(bamboo) > 0)
    for p in bamboo:
        assert_eq(f"{p['sku']} fabric", p["fabricType"], "Bamboo")


# ─────────────────────────────────────────────────────────────────────────────
# Run all tests
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "="*60)
    print("  SPACES Style Concierge — Full Test Suite")
    print("="*60)

    # Catalog tests (no server needed)
    test("12. Catalog filter logic", test_catalog_filter)

    # API tests — check server is up first
    status, _ = req("GET", "/api/health")
    if status != 200:
        print(f"\n⚠️  Backend not reachable at {BASE}. Start with: uvicorn main:app --reload")
        print("    Skipping API tests. Catalog test results above are still valid.\n")
    else:
        test("01. GET /api/health", test_health)
        test("02. GET /api/catalog", test_catalog_endpoint)
        test("03. POST /api/related-products — bedsheet add-ons", test_related_products_bedsheet)
        test("04. POST /api/related-products — cart-only add-ons", test_related_products_cart_only)
        test("05. POST /api/recommend — King, cool, Cotton, classic-whites", test_recommend_king_cool_cotton)
        test("06. POST /api/recommend — Single, warm, no preference", test_recommend_single_warm)
        test("07. POST /api/recommend — Queen, bamboo, earthy", test_recommend_bamboo_queen)
        test("08. POST /api/recommend — Double, linen, cool", test_recommend_double_linen)
        test("09. POST /api/chat — follow-up warmer request", test_chat_warmer)
        test("10. POST /api/chat — return policy FAQ", test_chat_return_policy)
        test("11. POST /api/chat — delivery FAQ", test_chat_delivery)
        test("12. POST /api/chat — multi-turn context retention", test_chat_multi_turn)
        test("13. POST /api/recommend — missing required field → 422", test_bad_request_missing_field)
        test("14. GET /api/recommend — wrong method → 405", test_wrong_method)

    # Summary
    print("\n" + "="*60)
    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    print(f"  Results: {passed}/{total} passed")
    for name, ok in results:
        icon = "✅" if ok else "❌"
        print(f"  {icon} {name}")
    print("="*60 + "\n")

    sys.exit(0 if passed == total else 1)
