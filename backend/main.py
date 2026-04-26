import json
import os
import time
from contextlib import asynccontextmanager

import openai
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from catalog import CATALOG, catalog_to_prompt_text, filter_catalog
from models import (
    CatalogResponse,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    RecommendRequest,
    RecommendResponse,
    RelatedProductsRequest,
    RelatedProductsResponse,
    RoomAnalysisRequest,
)
from prompts import CHAT_SYSTEM_PROMPT, RECOMMENDATION_SYSTEM_PROMPT, ROOM_ANALYSIS_SYSTEM_PROMPT

load_dotenv()

# ── OpenRouter client ─────────────────────────────────────────────────────────
_client: openai.OpenAI | None = None

# Ordered fallback list — tried in sequence until one succeeds.
# Gemma models don't support the system role; _call_llm handles that automatically.
FALLBACK_MODELS = [
    "openai/gpt-oss-120b:free",
    "openai/gpt-oss-20b:free",
    "minimax/minimax-m2.5:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-3-27b-it:free",
    "google/gemma-3-12b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.2-3b-instruct:free",
]
OPENROUTER_MODEL = FALLBACK_MODELS[0]  # used only for health/logging

# Vision models — ordered best-first. These accept image_url content parts.
VISION_MODELS = [
    "anthropic/claude-haiku-4.5",   # best quality, cheap (~$0.001/call)
    "amazon/nova-lite-v1",           # cheapest ($0.00001/call)
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-3-27b-it:free",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _client
    api_key = os.getenv("OPENROUTER_API_KEY")
    if api_key and not api_key.startswith("sk-or-v1-your"):
        _client = openai.OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            timeout=25.0,
            default_headers={
                "HTTP-Referer": "https://spaces.in",   # optional: shown in OpenRouter dashboard
                "X-Title": "SPACES Style Concierge POC",
            },
        )
        print(f"[OK] OpenRouter client ready -- model: {OPENROUTER_MODEL}")
    else:
        print("[WARN] No valid OPENROUTER_API_KEY found -- running in mock/demo mode.")
    yield


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SPACES Shopping Assistant API",
    description="AI-powered bedding recommendation widget backend (via OpenRouter)",
    version="0.1.0-poc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # POC only — lock to spaces.in before production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────
def _prefs_to_text(prefs) -> str:
    return (
        f"Bed Size: {prefs.bedSize}\n"
        f"Sleep Temperature: {prefs.sleepTemp}\n"
        f"Fabric Preference: {prefs.fabric}\n"
        f"Style Vibe: {prefs.styleVibe}"
    )


def _mock_recommendations() -> dict:
    """Return deterministic mock data when no API key is configured."""
    sample = CATALOG[:3]
    cards = []
    for p in sample:
        cards.append({
            "sku": p["sku"],
            "name": p["name"],
            "thumbnail_url": p["thumbnailUrl"],
            "product_url": p["productUrl"],
            "price": p["price"],
            "discounted_price": p.get("discountedPrice"),
            "reason": "Demo mode — add your OPENROUTER_API_KEY to .env for personalised AI picks.",
            "confidence": "high",
        })
    return {
        "intro_message": "Here are some popular picks from SPACES! (Running in demo mode — add your API key for personalised recommendations.)",
        "recommendations": cards,
    }


def _product_card_from_catalog(product: dict, reason: str, confidence: str = "medium") -> dict:
    return {
        "sku": product["sku"],
        "name": product["name"],
        "thumbnail_url": product["thumbnailUrl"],
        "product_url": product["productUrl"],
        "price": product["price"],
        "discounted_price": product.get("discountedPrice"),
        "reason": reason,
        "confidence": confidence,
    }


def _room_analysis_fallback(bed_size: str, filtered: list[dict], raw: str) -> RecommendResponse:
    products = filtered[:3] or filter_catalog(bed_size=bed_size, max_results=3) or filter_catalog(max_results=3)
    lower_raw = raw.lower()
    not_room = any(term in lower_raw for term in ["not a bedroom", "portrait", "person", "selfie"])
    intro = (
        "That upload does not look like a bedroom photo, so I could not read the room decor confidently. "
        f"Here are versatile {bed_size} picks while you upload a clearer room image."
        if not_room
        else
        "I could not read the room details confidently from that image. "
        f"Here are versatile {bed_size} picks that work well across many bedroom styles."
    )
    cards = [
        _product_card_from_catalog(
            p,
            f"A versatile {p['fabricType']} option for {bed_size} beds, with a balanced look that suits many room styles.",
            "medium",
        )
        for p in products
    ]
    return RecommendResponse(intro_message=intro, recommendations=cards)


def _find_product(sku: str | None) -> dict | None:
    if not sku:
        return None
    return next((p for p in CATALOG if p.get("sku") == sku), None)


def _related_products(selected_sku: str | None, cart_skus: list[str], limit: int = 4) -> tuple[str, list[dict]]:
    selected = _find_product(selected_sku)
    cart_set = set(cart_skus or [])
    if selected_sku:
        cart_set.add(selected_sku)

    complement_map = {
        "Bedsheet": ["Pillow Cover", "Pillow", "Bath Towel", "Duvet Cover", "Towel Set", "Bath Mat", "Cushion Cover"],
        "Pillow": ["Pillow Cover", "Bedsheet", "Duvet Cover", "Cushion Cover"],
        "Pillow Cover": ["Pillow", "Bedsheet", "Duvet Cover"],
        "Bath Towel": ["Bath Mat", "Hand Towel", "Towel Set", "Bath Robe", "Door Mat"],
        "Hand Towel": ["Bath Towel", "Bath Mat", "Towel Set"],
        "Towel Set": ["Bath Mat", "Bath Robe", "Hand Towel"],
        "Bath Mat": ["Bath Towel", "Towel Set", "Bath Robe"],
        "Duvet Cover": ["Pillow", "Pillow Cover", "Bedsheet"],
        "Cushion Cover": ["Bedsheet", "Bath Towel", "Door Mat"],
        "Door Mat": ["Bath Mat", "Towel Set", "Cushion Cover"],
    }

    selected_category = selected.get("category") if selected else None
    wanted = complement_map.get(selected_category, ["Bedsheet", "Bath Towel", "Pillow", "Bath Mat"])
    selected_styles = set(selected.get("styleAesthetic", [])) if selected else set()
    selected_tags = set(selected.get("tags", [])) if selected else set()

    scored = []
    for product in CATALOG:
        sku = product.get("sku")
        if sku in cart_set:
            continue
        score = 0
        category = product.get("category")
        if category in wanted:
            score += 100 - (wanted.index(category) * 10)
        if selected_styles.intersection(product.get("styleAesthetic", [])):
            score += 12
        if selected_tags.intersection(product.get("tags", [])):
            score += 8
        if product.get("discountedPrice") and product["discountedPrice"] < product["price"]:
            score += 5
        if not selected and category in ["Bedsheet", "Bath Towel", "Pillow", "Bath Mat"]:
            score += 10
        if score:
            scored.append((score, product))

    scored.sort(key=lambda item: (-item[0], item[1].get("discountedPrice") or item[1]["price"]))
    products = [product for _, product in scored[: max(1, min(limit, 8))]]

    if selected:
        intro = f"Complete the set around {selected['name']} with these SPACES add-ons."
    elif cart_skus:
        intro = "Based on the cart, these add-ons round out the room nicely."
    else:
        intro = "Start with these popular SPACES pairings across bed and bath."
    return intro, products


def _related_reason(product: dict, selected: dict | None) -> str:
    if selected:
        return f"Pairs well with {selected['category'].lower()} picks and adds a useful {product['category'].lower()} to the order."
    return f"A strong add-on SKU for the demo, adding {product['category'].lower()} coverage to the basket."


def _complete_recommendation_data(data: dict, candidate_pool: list[dict], target_count: int = 3) -> dict:
    recs = list(data.get("recommendations") or [])
    seen = {r.get("sku") for r in recs if isinstance(r, dict)}

    for product in candidate_pool:
        if len(recs) >= target_count:
            break
        if product["sku"] in seen:
            continue
        recs.append(_product_card_from_catalog(
            product,
            f"A strong fallback match in the right size, with {product['fabricType']} comfort and SPACES styling.",
            "medium",
        ))
        seen.add(product["sku"])

    data["recommendations"] = recs[:target_count]
    return data


def _try_model(model: str, msg_list: list[dict], max_tokens: int) -> str | None:
    """
    Attempt a single model call with one 429 retry.
    Returns content string on success, None if rate-limited, raises on other errors.
    """
    for attempt in range(2):
        response = _client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=msg_list,
        )
        content = response.choices[0].message.content
        if content is None:
            raise ValueError(f"Model {model} returned empty content (finish={response.choices[0].finish_reason})")
        return content.strip()
    return None  # unreachable but satisfies type checker


def _build_messages(system_prompt: str, base_msgs: list[dict], inject: bool) -> list[dict]:
    if inject:
        merged = list(base_msgs)
        if merged and merged[0]["role"] == "user":
            merged[0] = {"role": "user", "content": f"{system_prompt}\n\n{merged[0]['content']}"}
        else:
            merged = [{"role": "user", "content": system_prompt}] + merged
        return merged
    return [{"role": "system", "content": system_prompt}] + base_msgs


def _call_llm(system_prompt: str, user_message: str, messages: list[dict] | None = None, max_tokens: int = 1500) -> str:
    """
    Call OpenRouter with automatic model fallback and 429 retry.
    Tries each model in FALLBACK_MODELS; for models that reject the system role,
    automatically injects the system prompt into the first user message.
    """
    base_msgs: list[dict] = list(messages) if messages else []
    if user_message:
        base_msgs = base_msgs + [{"role": "user", "content": user_message}]

    last_error: Exception | None = None

    for model in FALLBACK_MODELS:
        needs_injection = False
        for attempt in range(3):  # up to 2 retries on 429 per model
            msg_list = _build_messages(system_prompt, base_msgs, inject=needs_injection)
            try:
                content = _try_model(model, msg_list, max_tokens)
                return content  # type: ignore[return-value]
            except openai.RateLimitError as e:
                last_error = e
                if attempt < 2:
                    time.sleep(2 ** attempt)  # 1s, 2s
                    continue
                break  # exhausted retries — move to next model
            except openai.BadRequestError as e:
                last_error = e
                err_str = str(e)
                if not needs_injection and ("not enabled" in err_str or "system" in err_str.lower()):
                    needs_injection = True
                    continue  # retry same model with injected system prompt
                break  # unrecoverable bad request — move to next model
            except Exception as e:
                last_error = e
                break  # unexpected error — move to next model

    raise HTTPException(status_code=502, detail=f"All models failed. Last error: {last_error}")


def _call_vision_llm(system_prompt: str, image_base64: str, image_mime: str, text: str, max_tokens: int = 1500) -> str:
    """
    Call a vision-capable model with a base64 image + text prompt.
    Falls back through VISION_MODELS in order.
    """
    data_url = f"data:{image_mime};base64,{image_base64}"
    last_error: Exception | None = None

    for model in VISION_MODELS:
        for attempt in range(2):
            try:
                messages: list[dict] = [
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": data_url}},
                            {"type": "text", "text": f"{system_prompt}\n\n{text}"},
                        ],
                    }
                ]
                response = _client.chat.completions.create(
                    model=model,
                    max_tokens=max_tokens,
                    messages=messages,
                )
                content = response.choices[0].message.content
                if content is None:
                    raise ValueError(f"Model {model} returned empty content")
                return content.strip()
            except openai.RateLimitError as e:
                last_error = e
                if attempt == 0:
                    time.sleep(2)
                    continue
                break
            except Exception as e:
                last_error = e
                break

    raise HTTPException(status_code=502, detail=f"All vision models failed. Last error: {last_error}")


def _build_chat_messages(history: list, image_base64: str | None, image_mime: str | None) -> list[dict]:
    """Convert ChatMessage history to OpenAI message dicts, including any inline images."""
    msgs: list[dict] = []
    for m in history:
        if m.image_base64:
            data_url = f"data:{m.image_mime or 'image/jpeg'};base64,{m.image_base64}"
            msgs.append({
                "role": m.role,
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {"type": "text", "text": m.content},
                ],
            })
        else:
            msgs.append({"role": m.role, "content": m.content})
    return msgs


def _parse_json_object(raw: str) -> dict:
    """
    Parse the first JSON object from model output.
    Handles markdown fences and ignores trailing prose/fences after the object.
    """
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
    text = text.strip()

    start = text.find("{")
    if start == -1:
        raise json.JSONDecodeError("No JSON object found", text, 0)

    data, _ = json.JSONDecoder().raw_decode(text[start:])
    if not isinstance(data, dict):
        raise json.JSONDecodeError("Top-level JSON value must be an object", text, start)
    return data


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "catalog_size": len(CATALOG),
        "ai_enabled": _client is not None,
        "model": OPENROUTER_MODEL if _client else "demo-mode",
        "provider": "OpenRouter",
    }


@app.get("/api/catalog", response_model=CatalogResponse)
def get_catalog():
    return CatalogResponse(products=CATALOG)


@app.post("/api/related-products", response_model=RelatedProductsResponse)
def related_products(req: RelatedProductsRequest):
    intro, products = _related_products(req.selected_sku, req.cart_skus, req.limit)
    selected = _find_product(req.selected_sku)
    cards = [
        _product_card_from_catalog(product, _related_reason(product, selected), "high")
        for product in products
    ]
    return RelatedProductsResponse(intro_message=intro, recommendations=cards)

@app.get("/api/test_llm")
def test_llm():
    try:
        system_prompt = RECOMMENDATION_SYSTEM_PROMPT.format(
            preferences="bedSize: King\nfabric: Cotton",
            catalog=catalog_to_prompt_text(CATALOG[:3])
        )
        raw = _call_llm(system_prompt, "Please recommend the 3 best products for me.")
        return {"status": "success", "response": raw}
    except Exception as e:
        import traceback
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}


@app.post("/api/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest):
    prefs = req.preferences

    # Pre-filter catalog to keep prompt lean
    filtered = filter_catalog(
        bed_size=prefs.bedSize,
        sleep_temp=prefs.sleepTemp,
        fabric=prefs.fabric,
        style_vibe=prefs.styleVibe,
    )

    if not _client:
        mock = _mock_recommendations()
        return RecommendResponse(**mock)

    system_prompt = RECOMMENDATION_SYSTEM_PROMPT.format(
        preferences=_prefs_to_text(prefs),
        catalog=catalog_to_prompt_text(filtered),
    )

    raw = ""
    try:
        raw = _call_llm(system_prompt, "Please recommend the 3 best products for me.")
        data = _parse_json_object(raw)
        fallback_pool = filtered + filter_catalog(bed_size=prefs.bedSize, max_results=len(CATALOG))
        data = _complete_recommendation_data(data, fallback_pool)
        return RecommendResponse(**data)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"AI returned invalid JSON: {e}. Raw: {raw[:300]}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error: {str(e)}. Raw: {raw[:300]}")


@app.post("/api/analyze-room", response_model=RecommendResponse)
def analyze_room(req: RoomAnalysisRequest):
    if not _client:
        mock = _mock_recommendations()
        return RecommendResponse(**mock)

    filtered = filter_catalog(bed_size=req.bed_size)
    system_prompt = ROOM_ANALYSIS_SYSTEM_PROMPT.format(
        bed_size=req.bed_size,
        catalog=catalog_to_prompt_text(filtered),
    )

    raw = ""
    try:
        raw = _call_vision_llm(
            system_prompt=system_prompt,
            image_base64=req.image_base64,
            image_mime=req.image_mime,
            text="Please analyse this room and recommend the 3 best-matching bedsheet products.",
        )
        data = _parse_json_object(raw)
        data = _complete_recommendation_data(data, filtered)
        return RecommendResponse(**data)
    except (json.JSONDecodeError, ValidationError):
        return _room_analysis_fallback(req.bed_size, filtered, raw)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error: {str(e)}. Raw: {raw[:300]}")


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    prefs = req.preferences

    filtered = filter_catalog(
        bed_size=prefs.bedSize,
        sleep_temp=prefs.sleepTemp,
        fabric=prefs.fabric,
        style_vibe=prefs.styleVibe,
    )

    recs_text = "\n".join(
        f"• {r['name']} (SKU: {r['sku']}) — ₹{r.get('discounted_price') or r['price']} — {r['product_url']}"
        for r in req.recommendations
    )

    if not _client:
        return ChatResponse(
            message="I'm in demo mode — add OPENROUTER_API_KEY to .env for live conversations! In the meantime, feel free to explore the products above.",
        )

    system_prompt = CHAT_SYSTEM_PROMPT.format(
        preferences=_prefs_to_text(prefs),
        recommendations=recs_text,
        catalog=catalog_to_prompt_text(filtered),
    )

    history_msgs = _build_chat_messages(req.history, None, None)

    # If current message has an image, use vision LLM
    if req.image_base64:
        try:
            full_context = system_prompt + "\n\nUser question: " + req.message
            reply = _call_vision_llm(
                system_prompt=full_context,
                image_base64=req.image_base64,
                image_mime=req.image_mime or "image/jpeg",
                text=req.message,
                max_tokens=512,
            )
            return ChatResponse(message=reply)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Vision API error: {e}")

    try:
        reply = _call_llm(
            system_prompt,
            user_message=req.message,
            messages=history_msgs,
            max_tokens=512,
        )

        # Auto cross-sell: on the first chat reply, include complementary products
        # so the widget can surface them as "you might also like" cards
        suggested = None
        if len(req.history) == 0 and req.recommendations:
            first_sku = req.recommendations[0].get("sku") if req.recommendations else None
            if first_sku:
                cart_skus = [r.get("sku") for r in req.recommendations if r.get("sku")]
                _, related = _related_products(first_sku, cart_skus, limit=3)
                if related:
                    selected_item = _find_product(first_sku)
                    suggested = [
                        _product_card_from_catalog(p, _related_reason(p, selected_item), "high")
                        for p in related
                    ]

        return ChatResponse(message=reply, suggested_products=suggested)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenRouter API error: {e}")

# Serve the frontend widget directory
app.mount("/", StaticFiles(directory="../widget", html=True), name="widget")
