'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Shared utilities for all SPACES Style Concierge Netlify Functions
// ─────────────────────────────────────────────────────────────────────────────

// ── Catalog ───────────────────────────────────────────────────────────────────
// NOTE: Use a static string so Netlify's bundler can trace the dependency.
const CATALOG = require('../../backend/data/spaces_catalog.json');

const FABRIC_MAP = {
  Cotton: ['Hygro Cotton', 'Percale Cotton', 'Sateen Cotton', 'Flannel', 'Cotton Blend'],
  Linen:  ['Linen Blend'],
  Bamboo: ['Bamboo'],
};

function filterCatalog({ bedSize, sleepTemp, fabric, styleVibe, maxResults = 12 } = {}) {
  let results = [...CATALOG];

  if (bedSize && bedSize !== 'No preference')
    results = results.filter(p => (p.bedSize || []).includes(bedSize));

  if (fabric && fabric !== 'No preference') {
    const allowed = FABRIC_MAP[fabric] || [];
    if (allowed.length) {
      const matching = results.filter(p => allowed.includes(p.fabricType));
      if (matching.length) results = matching;
    }
  }

  if (sleepTemp && sleepTemp !== 'No preference') {
    const matching = results.filter(p => p.sleepTempRating === sleepTemp);
    if (matching.length) results = matching;
  }

  if (styleVibe && styleVibe !== 'No preference') {
    const matching = results.filter(p => (p.styleAesthetic || []).includes(styleVibe));
    if (matching.length) results = matching;
  }

  return results.slice(0, maxResults);
}

function catalogToPromptText(products) {
  return products.map(p => {
    const disc     = p.discountedPrice ? ` (sale: ₹${p.discountedPrice})` : '';
    const tc       = p.threadCount    ? `, ${p.threadCount}TC`             : '';
    const features = (p.keyFeatures || []).join('; ');
    return `• [${p.sku}] ${p.name} | ${p.fabricType}${tc} | ₹${p.price}${disc} | ` +
      `Temp: ${p.sleepTempRating || '?'} | Style: ${(p.styleAesthetic || []).join(', ')} | ` +
      `URL: ${p.productUrl} | IMG: ${p.thumbnailUrl} | Features: ${features}`;
  }).join('\n');
}

function findProduct(sku) {
  if (!sku) return null;
  return CATALOG.find(p => p.sku === sku) || null;
}

function productCardFromCatalog(product, reason, confidence = 'medium') {
  return {
    sku:             product.sku,
    name:            product.name,
    thumbnail_url:   product.thumbnailUrl,
    product_url:     product.productUrl,
    price:           product.price,
    discounted_price: product.discountedPrice || null,
    reason,
    confidence,
  };
}

function relatedProducts(selectedSku, cartSkus = [], limit = 4) {
  const selected = findProduct(selectedSku);
  const cartSet  = new Set([...cartSkus, selectedSku].filter(Boolean));

  const complementMap = {
    'Bedsheet':     ['Pillow Cover', 'Pillow', 'Bath Towel', 'Duvet Cover', 'Towel Set', 'Bath Mat', 'Cushion Cover'],
    'Pillow':       ['Pillow Cover', 'Bedsheet', 'Duvet Cover', 'Cushion Cover'],
    'Pillow Cover': ['Pillow', 'Bedsheet', 'Duvet Cover'],
    'Bath Towel':   ['Bath Mat', 'Hand Towel', 'Towel Set', 'Bath Robe', 'Door Mat'],
    'Hand Towel':   ['Bath Towel', 'Bath Mat', 'Towel Set'],
    'Towel Set':    ['Bath Mat', 'Bath Robe', 'Hand Towel'],
    'Bath Mat':     ['Bath Towel', 'Towel Set', 'Bath Robe'],
    'Duvet Cover':  ['Pillow', 'Pillow Cover', 'Bedsheet'],
    'Cushion Cover':['Bedsheet', 'Bath Towel', 'Door Mat'],
    'Door Mat':     ['Bath Mat', 'Towel Set', 'Cushion Cover'],
  };

  const wanted        = complementMap[selected?.category] || ['Bedsheet', 'Bath Towel', 'Pillow', 'Bath Mat'];
  const selectedStyles = new Set(selected?.styleAesthetic || []);
  const selectedTags   = new Set(selected?.tags || []);

  const scored = [];
  for (const p of CATALOG) {
    if (cartSet.has(p.sku)) continue;
    let score = 0;
    const idx = wanted.indexOf(p.category);
    if (idx !== -1) score += 100 - idx * 10;
    if ([...selectedStyles].some(s => (p.styleAesthetic || []).includes(s))) score += 12;
    if ([...selectedTags].some(t => (p.tags || []).includes(t))) score += 8;
    if (p.discountedPrice && p.discountedPrice < p.price) score += 5;
    if (!selected && ['Bedsheet', 'Bath Towel', 'Pillow', 'Bath Mat'].includes(p.category)) score += 10;
    if (score) scored.push([score, p]);
  }

  scored.sort((a, b) => b[0] - a[0] || (a[1].discountedPrice || a[1].price) - (b[1].discountedPrice || b[1].price));
  const products = scored.slice(0, Math.max(1, Math.min(limit, 8))).map(([, p]) => p);

  const intro = selected
    ? `Complete the set around ${selected.name} with these SPACES add-ons.`
    : cartSkus.length
      ? 'Based on the cart, these add-ons round out the room nicely.'
      : 'Start with these popular SPACES pairings across bed and bath.';

  return { intro, products };
}

function relatedReason(product, selected) {
  return selected
    ? `Pairs well with ${selected.category.toLowerCase()} picks and adds a useful ${product.category.toLowerCase()} to the order.`
    : `A strong add-on, adding ${product.category.toLowerCase()} coverage to the basket.`;
}

// ── OpenRouter LLM ────────────────────────────────────────────────────────────
const FALLBACK_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-lite-preview-02-05:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'nvidia/llama-3.1-nemotron-70b-instruct:free',
];
// Groq vision model (free tier via api.groq.com)
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

async function callOpenRouter(model, messages, maxTokens) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw Object.assign(new Error('OPENROUTER_API_KEY not set'), { status: 500 });

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://spaces.in',
      'X-Title': 'SPACES Style Concierge',
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`), { status: res.status });
  }
  const data    = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Model ${model} returned empty content`);
  return content.trim();
}

async function callGroq(model, messages, maxTokens) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw Object.assign(new Error('GROQ_API_KEY not set'), { status: 500 });

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Groq ${res.status}: ${text.slice(0, 200)}`), { status: res.status });
  }
  const data    = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Groq model ${model} returned empty content`);
  return content.trim();
}

async function callLLM(systemPrompt, userMessage, historyMessages = [], maxTokens = 1500) {
  const base = [...historyMessages, { role: 'user', content: userMessage }];
  let lastError;

  // Try Groq first (fastest), then fall back to OpenRouter
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const messages = [{ role: 'system', content: systemPrompt }, ...base];
      return await callGroq('meta-llama/llama-4-scout-17b-16e-instruct', messages, maxTokens);
    } catch (e) {
      lastError = e;
      console.log('Groq text failed, falling back to OpenRouter:', e.message);
    }
  }

  for (const model of FALLBACK_MODELS) {
    let needsInjection = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const messages = needsInjection
        ? [{ role: 'user', content: `${systemPrompt}\n\n${base[0]?.content || userMessage}` }, ...base.slice(1)]
        : [{ role: 'system', content: systemPrompt }, ...base];
      try {
        return await callOpenRouter(model, messages, maxTokens);
      } catch (e) {
        lastError = e;
        if (e.status === 429 && attempt < 2) { await delay(1000 * (attempt + 1)); continue; }
        if (e.status === 400 && !needsInjection)  { needsInjection = true; continue; }
        break;
      }
    }
  }
  throw lastError || new Error('All models failed');
}

async function callVisionLLM(systemPrompt, imageBase64, imageMime, text, maxTokens = 1500) {
  const dataUrl = `data:${imageMime};base64,${imageBase64}`;

  // Use Groq for vision (free, fast, reliable)
  try {
    return await callGroq(GROQ_VISION_MODEL, [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text',      text: `${systemPrompt}\n\n${text}` },
      ],
    }], maxTokens);
  } catch (e) {
    console.error('Groq vision failed:', e.message);
    throw e;
  }
}

function parseJsonObject(raw) {
  let text = raw.trim();
  if (text.startsWith('```')) text = text.split('\n').slice(1).join('\n').replace(/```\s*$/, '').trim();
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  return JSON.parse(text.slice(start, end + 1));
}

const delay = ms => new Promise(r => setTimeout(r, ms));

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

// ── Prompt templates ──────────────────────────────────────────────────────────
const RECOMMENDATION_SYSTEM_PROMPT = `You are SPACES Style Concierge — a warm, knowledgeable shopping assistant for SPACES, India's premium home linen brand.

Your job is to analyse a shopper's stated preferences and recommend the 3 BEST-MATCHING products from the catalog below.

## Rules
1. Return ONLY valid JSON — no markdown fences, no extra text before or after.
2. The JSON must match this exact schema:
   {"intro_message":"<1–2 sentence personalised opener>","recommendations":[{"sku":"<exact SKU>","name":"<exact name>","thumbnail_url":"<exact URL>","product_url":"<exact URL>","price":<int>,"discounted_price":<int|null>,"reason":"<15–25 word personal reason>","confidence":"<high|medium|low>"}]}
3. Rank recommendations best-match first.
4. Prioritise products that match the bed size exactly (non-negotiable).
5. "No preference" → pick most versatile/popular option.
6. Never hallucinate SKUs, prices, or URLs.
7. Tone: aspirational but accessible, slightly warm, never pushy.

## Shopper Preferences
{preferences}

## Available Catalog
{catalog}`;

const ROOM_ANALYSIS_SYSTEM_PROMPT = `You are SPACES Style Concierge — a warm, knowledgeable home-linen stylist for SPACES, India's premium bedding brand.

Analyse the room photo and pick 3 BEST-MATCHING bedsheet products from the catalog.
Return ONLY valid JSON:
{"intro_message":"<warm opener referencing the room>","detected_style":"<short style phrase>","recommendations":[{"sku":"<exact SKU>","name":"<exact name>","thumbnail_url":"<exact URL>","product_url":"<exact URL>","price":<int>,"discounted_price":<int|null>,"reason":"<15–25 words tying product to room>","confidence":"<high|medium|low>"}]}

Rules:
- Bed size: {bedSize} — only recommend products available in this size (non-negotiable).
- Match room's dominant colours and mood.
- If image is unclear, set detected_style to "unclear room photo" and pick 3 versatile products.
- Never answer outside the JSON. Never hallucinate.

## Available Catalog
{catalog}`;

const CHAT_SYSTEM_PROMPT = `You are SPACES Style Concierge — a warm, knowledgeable shopping assistant for SPACES, India's premium home linen brand.

## Shopper Preferences
{preferences}

## Products Already Shown
{recommendations}

## Behaviour Guidelines
- Be concise: 2–4 sentences max.
- Return/exchange: "SPACES offers a 30-day easy return policy. Initiate via website or call 1800-123-4567."
- Delivery: "SPACES delivers pan-India within 5–7 business days. Express delivery in metro cities."
- Unknown info: direct to product page or customer care.
- Never fabricate. Stay on-topic: home linen, bedding, SPACES products.
- Tone: friendly expert, warm but not pushy.

## Cross-sell Strategy
After the shopper seems happy with their pick, ONCE — gently mention 1–2 complementary products in one warm sentence. Never repeat if declined.
- Bedsheet chosen → suggest: pillow cover, bath towel, or cushion cover
- Towels chosen → suggest: bath mat or towel set

## Full Available Catalog
{catalog}`;

module.exports = {
  CATALOG,
  filterCatalog,
  catalogToPromptText,
  findProduct,
  productCardFromCatalog,
  relatedProducts,
  relatedReason,
  callLLM,
  callVisionLLM,
  parseJsonObject,
  corsHeaders,
  RECOMMENDATION_SYSTEM_PROMPT,
  ROOM_ANALYSIS_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
};
