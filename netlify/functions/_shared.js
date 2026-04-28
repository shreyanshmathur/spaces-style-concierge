'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Shared utilities for all SPACES Style Concierge Netlify Functions
// ─────────────────────────────────────────────────────────────────────────────

// ── Catalog ───────────────────────────────────────────────────────────────────
// NOTE: Use a static string so Netlify's bundler can trace the dependency.
const CATALOG = require('../../backend/data/spaces_catalog.json');

function stripDashes(text) {
  if (typeof text !== 'string') return text;
  // Replace em-dash (\u2014) and en-dash (\u2013) with hyphen (-)
  return text.replace(/\u2014/g, '-').replace(/\u2013/g, '-');
}

function cleanProduct(p) {
  return {
    ...p,
    name: stripDashes(p.name),
    reason: stripDashes(p.reason),
    fabricType: stripDashes(p.fabricType)
  };
}

const FABRIC_MAP = {
  Cotton: ['Hygro Cotton', 'Percale Cotton', 'Sateen Cotton', 'Flannel', 'Cotton Blend'],
  Linen:  ['Linen Blend'],
  Bamboo: ['Bamboo'],
};

function filterCatalog({ bedSize, sleepTemp, fabric, styleVibe, maxResults = 12 } = {}) {
  let results = [...CATALOG];

  // STRICT size filtering
  if (bedSize && bedSize !== 'No preference') {
    const matchedSize = results.filter(p => p.bedSize && p.bedSize.includes(bedSize));
    if (matchedSize.length > 0) {
      // ONLY show exact size matches + accessories
      results = results.filter(p => !p.bedSize || p.bedSize.length === 0 || p.bedSize.includes(bedSize));
    } else {
      // If NO bedsheets match this size, ONLY show accessories (pillows/towels)
      // This forces the AI to acknowledge we have no sheets in that size.
      results = results.filter(p => !p.bedSize || p.bedSize.length === 0);
    }
  }

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

  // Final check: if we filtered down to nothing, return the first few versatile items
  if (results.length === 0) return CATALOG.slice(0, maxResults).map(cleanProduct);

  return results.slice(0, maxResults).map(cleanProduct);
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
  return stripDashes(content.trim());
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
  return stripDashes(content.trim());
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
const RECOMMENDATION_SYSTEM_PROMPT = `You are the Expert Stylist at SPACES — India's leading luxury home linen brand.

Your goal is to be a charismatic, high-energy salesperson. Don't just list products; build a "vibe" and sell the experience of a comfortable, premium home.

## Formatting Rules (CRITICAL)
1. NEVER use en-dashes (–) or em-dashes (—). Only use standard hyphens (-) or colons (:).
2. Return ONLY valid JSON — no markdown fences, no extra text.

## Selling Rules
1. Recommendations must match the bed size "{preferences.bedSize}" EXACTLY. If the catalog provides no bedsidheet in that size, start the intro_message by saying "I noticed we don't have that exact size in this style right now, but here's how we can elevate your space otherwise" and show the next best things.
2. The JSON must match this schema:
   {"intro_message":"<Charismatic opening statement identifying as an expert stylist>","recommendations":[{"sku":"<exact SKU>","name":"<exact name>","thumbnail_url":"<exact URL>","product_url":"<exact URL>","price":<int>,"discounted_price":<int|null>,"reason":"<Charismatic salesperson pitch: why this is a MUST-HAVE for them>","confidence":"<high|medium|low>"}]}
3. After recommending a bedsheet, ALWAYS suggest a complementary product (towels or pillows) in the intro_message.

## Shopper Preferences
{preferences}

## Available Catalog
{catalog}`;

const ROOM_ANALYSIS_SYSTEM_PROMPT = `You are the Lead Stylist at SPACES. You are helping a client transform their room based on a photo they just shared.

Be enthusiastic! Comment on their room's potential and how SPACES can make it feel like a 5-star hotel.

## Rules
1. STRICTLY RECOMMEND only products available in requested size: {bedSize}. If no bedsheets match, explain this warmly in the intro_message.
2. NO EN-DASHES (–) OR EM-DASHES (—).
3. Generate valid JSON:
{"intro_message":"<Charismatic salesperson opening praising the room's potential>","detected_style":"<Salesperson style name>","recommendations":[{"sku":"<exact SKU>","name":"<exact name>","thumbnail_url":"<exact URL>","product_url":"<exact URL>","price":<int>,"discounted_price":<int|null>,"reason":"<Pitch: why this specific product perfectly complements their existing decor>","confidence":"<high|medium|low>"}]}

## Image Interaction
- If the user asks a question about the photo (e.g., "what colour is my wall?"), answer it enthusiastically in the intro_message before getting into the products.
- If the photo isn't a room, politely mention you're a bedding expert but still try to find a style that fits the "energy" of the photo.

## Available Catalog
{catalog}`;

const CHAT_SYSTEM_PROMPT = `You are the Expert Stylist from SPACES. You are a high-end salesperson: warm, professional, but deeply enthusiastic about premium linens.

## Behaviour Guidelines
- NEVER use en-dashes (–) or em-dashes (—).
- Talk like a human, not a bot. Use phrases like "If I were styling your room..." or "This is a personal favourite...".
- Be concise but punchy (3-4 sentences).
- If a specific bed size is requested ({preferences}), ONLY show products that have it. If none exist, say so directly and suggest an alternative category.
- If the user picks a bedsheet, ALWAYS push for a cross-sell (pillow covers, towels, or rugs). Say something like "To really get that premium look, you MUST pair this with our...".

## Policy Info
- Returns: 30-day easy policy via website or call 1800-123-4567.
- Delivery: 5-7 days pan-India.

## Shopper Preferences
{preferences}

## Products Already Shown
{recommendations}

## Available Catalog
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
