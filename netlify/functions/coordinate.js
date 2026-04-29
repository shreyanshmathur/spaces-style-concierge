'use strict';
const {
  corsHeaders,
  CATALOG,
  catalogToPromptText,
  findProduct,
  productCardFromCatalog,
  callLLM,
  parseJsonObject,
  COORDINATE_SYSTEM_PROMPT,
} = require('./_shared');

const COORD_CATEGORIES = ['Pillow Cover', 'Bath Towel', 'Bath Mat', 'Cushion Cover', 'Duvet Cover'];

function fallbackItems(coordItems) {
  const seen = new Set();
  const items = [];
  for (const p of coordItems) {
    if (!seen.has(p.category)) {
      seen.add(p.category);
      items.push({
        sku:             p.sku,
        name:            p.name,
        category:        p.category,
        thumbnail_url:   p.thumbnailUrl,
        product_url:     p.productUrl,
        price:           p.price,
        discounted_price: p.discountedPrice || null,
        reason:          'A harmonious addition to complete your coordinated home look.',
        confidence:      'medium',
      });
    }
    if (items.length >= 4) break;
  }
  return items;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  try {
    const { anchor_sku, style_aesthetic } = JSON.parse(event.body || '{}');

    const anchor   = findProduct(anchor_sku);
    let coordItems = CATALOG.filter(p => COORD_CATEGORIES.includes(p.category));

    // Prefer products that share the anchor's styleAesthetic
    const anchorStyles = anchor?.styleAesthetic || (style_aesthetic ? [style_aesthetic] : []);
    if (anchorStyles.length) {
      const styleMatch = coordItems.filter(p =>
        anchorStyles.some(s => (p.styleAesthetic || []).includes(s))
      );
      if (styleMatch.length >= 3) coordItems = styleMatch;
    }

    const anchorText = anchor
      ? `SKU: ${anchor.sku}, Name: ${anchor.name}, Color: ${anchor.color || ''}, Style: ${(anchor.styleAesthetic || []).join(', ')}`
      : `Style preference: ${anchorStyles.join(', ') || 'versatile'}`;

    const systemPrompt = COORDINATE_SYSTEM_PROMPT
      .replace('{anchor}',  anchorText)
      .replace('{catalog}', catalogToPromptText(coordItems));

    const raw = await callLLM(systemPrompt, 'Build a complete coordinated look for this customer.', [], 800);

    let data;
    try {
      data = parseJsonObject(raw);
    } catch {
      data = {
        look_title:    'Curated for You',
        intro_message: "Here is a coordinated set I've put together to complement your style.",
        items:         fallbackItems(coordItems),
      };
    }

    return {
      statusCode: 200,
      headers:    corsHeaders(),
      body:       JSON.stringify(data),
    };
  } catch (err) {
    console.error('coordinate error:', err);
    return {
      statusCode: 500,
      headers:    corsHeaders(),
      body:       JSON.stringify({ error: err.message }),
    };
  }
};
