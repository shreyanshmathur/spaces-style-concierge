import json
from pathlib import Path
from typing import Optional

_CATALOG_PATH = Path(__file__).parent / "data" / "spaces_catalog.json"

# Load once at import time
with open(_CATALOG_PATH, encoding="utf-8") as f:
    CATALOG: list[dict] = json.load(f)


def filter_catalog(
    bed_size: Optional[str] = None,
    sleep_temp: Optional[str] = None,
    fabric: Optional[str] = None,
    style_vibe: Optional[str] = None,
    max_results: int = 12,
) -> list[dict]:
    """
    Pre-filter catalog before sending to Claude.
    Applies hard filters first (size), then soft filters (fabric, temp, style).
    Returns at most `max_results` items so the prompt stays token-lean.
    """
    results = list(CATALOG)

    # Hard filter: bed size (must match)
    if bed_size and bed_size != "No preference":
        results = [p for p in results if bed_size in p.get("bedSize", [])]

    # Soft filter: fabric preference
    if fabric and fabric != "No preference":
        fabric_map = {
            "Cotton": ["Hygro Cotton", "Percale Cotton", "Sateen Cotton", "Flannel", "Cotton Blend"],
            "Linen": ["Linen Blend"],
            "Bamboo": ["Bamboo"],
        }
        allowed_fabrics = fabric_map.get(fabric, [])
        if allowed_fabrics:
            # Prefer matching, but don't hard-exclude
            matching = [p for p in results if p.get("fabricType") in allowed_fabrics]
            results = matching if matching else results

    # Soft filter: sleep temperature
    if sleep_temp and sleep_temp != "No preference":
        matching = [p for p in results if p.get("sleepTempRating") == sleep_temp]
        results = matching if matching else results

    # Soft filter: style aesthetic
    if style_vibe and style_vibe != "No preference":
        matching = [p for p in results if style_vibe in p.get("styleAesthetic", [])]
        results = matching if matching else results

    return results[:max_results]


def catalog_to_prompt_text(products: list[dict]) -> str:
    """Convert catalog subset to a compact human-readable block for injection into prompts."""
    lines = []
    for p in products:
        disc = f" (sale: ₹{p['discountedPrice']})" if p.get("discountedPrice") else ""
        tc = f", {p['threadCount']}TC" if p.get("threadCount") else ""
        features = "; ".join(p.get("keyFeatures", []))
        lines.append(
            f"• [{p['sku']}] {p['name']} | {p['fabricType']}{tc} | ₹{p['price']}{disc} | "
            f"Temp: {p.get('sleepTempRating','?')} | Style: {', '.join(p.get('styleAesthetic',[]))} | "
            f"URL: {p['productUrl']} | IMG: {p['thumbnailUrl']} | Features: {features}"
        )
    return "\n".join(lines)
