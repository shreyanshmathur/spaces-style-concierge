from pydantic import BaseModel, Field
from typing import Optional


# ── Incoming ────────────────────────────────────────────────────────────────

class Preferences(BaseModel):
    bedSize: str               # "Single" | "Double" | "Queen" | "King"
    sleepTemp: str             # "cool" | "neutral" | "warm"
    fabric: str                # "Cotton" | "Linen" | "Bamboo" | "No preference"
    styleVibe: str             # "classic-whites" | "earthy-tones" | "bold-colorful" | "No preference"


class RecommendRequest(BaseModel):
    preferences: Preferences


class RoomAnalysisRequest(BaseModel):
    image_base64: str          # base64-encoded image (no data-URI prefix)
    image_mime: str = "image/jpeg"   # mime type
    bed_size: str              # still required — can't determine from photo


class ChatMessage(BaseModel):
    role: str                  # "user" | "assistant"
    content: str
    image_base64: Optional[str] = None   # for multimodal follow-up messages
    image_mime: Optional[str] = None


class ChatRequest(BaseModel):
    preferences: Preferences
    recommendations: list[dict]   # the 3 products already shown
    history: list[ChatMessage]    # full conversation so far
    message: str                  # latest user message
    image_base64: Optional[str] = None   # optional image attached to current message
    image_mime: Optional[str] = None


class RelatedProductsRequest(BaseModel):
    selected_sku: Optional[str] = None
    cart_skus: list[str] = Field(default_factory=list)
    limit: int = 4


# ── Outgoing ────────────────────────────────────────────────────────────────

class ProductCard(BaseModel):
    sku: str
    name: str
    thumbnail_url: str
    product_url: str
    price: int
    discounted_price: Optional[int] = None
    reason: str
    confidence: str            # "high" | "medium" | "low"


class RecommendResponse(BaseModel):
    recommendations: list[ProductCard]
    intro_message: str


class ChatResponse(BaseModel):
    message: str
    suggested_products: Optional[list[ProductCard]] = None


class CatalogResponse(BaseModel):
    products: list[dict]


class RelatedProductsResponse(BaseModel):
    intro_message: str
    recommendations: list[ProductCard]
