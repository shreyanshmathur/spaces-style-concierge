'use strict';
const {
  corsHeaders,
  CATALOG,
  catalogToPromptText,
  findProduct,
  productCardFromCatalog,
  relatedProducts,
  callLLM,
  CHAT_SYSTEM_PROMPT,
} = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      message,
      history         = [],
      preferences     = {},
      recommendations = [],
    } = body;

    if (!message) {
      return {
        statusCode: 400,
        headers:    corsHeaders(),
        body:       JSON.stringify({ error: 'message is required' }),
      };
    }

    const prefsText = Object.entries(preferences)
      .filter(([, v]) => v && v !== 'No preference')
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n') || 'No specific preferences stated.';

    const shownText = recommendations.length
      ? recommendations.map(r => `- [${r.sku}] ${r.name} - Rs.${r.discounted_price || r.price}`).join('\n')
      : 'None shown yet.';

    const catalogText = catalogToPromptText(CATALOG.slice(0, 40));

    const systemPrompt = CHAT_SYSTEM_PROMPT
      .replace('{preferences}',     prefsText)
      .replace('{recommendations}', shownText)
      .replace('{catalog}',         catalogText);

    const historyMessages = (Array.isArray(history) ? history : [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .map(m => ({ role: m.role, content: String(m.content) }));

    const reply = await callLLM(systemPrompt, message, historyMessages, 600);

    // On the first chat turn, surface cross-sell suggestions
    let suggested_products = null;
    if (history.length === 0 && recommendations.length > 0) {
      const firstSku  = recommendations[0]?.sku;
      const cartSkus  = recommendations.map(r => r.sku).filter(Boolean);
      const { products } = relatedProducts(firstSku, cartSkus, 3);
      const anchor    = findProduct(firstSku);
      if (products.length) {
        suggested_products = products.map(p =>
          productCardFromCatalog(
            p,
            `Pairs well with your selection for a complete, coordinated look.`,
            'medium',
          )
        );
      }
    }

    return {
      statusCode: 200,
      headers:    corsHeaders(),
      body:       JSON.stringify({ message: reply, suggested_products }),
    };
  } catch (err) {
    console.error('chat error:', err);
    return {
      statusCode: 500,
      headers:    corsHeaders(),
      body:       JSON.stringify({ error: err.message }),
    };
  }
};
