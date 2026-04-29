'use strict';
const {
  corsHeaders,
  CATALOG,
  catalogToPromptText,
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
      history        = [],      // [{role, content}]
      preferences    = {},      // {bed_size, sleep_temp, fabric, style_vibe}
      recommendations = [],     // product cards already shown
    } = body;

    if (!message) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'message is required' }),
      };
    }

    // Build preferences text
    const prefsText = Object.entries(preferences)
      .filter(([, v]) => v && v !== 'No preference')
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n') || 'No specific preferences stated.';

    // Build already-shown products text
    const shownText = recommendations.length
      ? recommendations.map(r => `• [${r.sku}] ${r.name} — ₹${r.discounted_price || r.price}`).join('\n')
      : 'None shown yet.';

    // Full catalog for cross-sell awareness
    const catalogText = catalogToPromptText(CATALOG.slice(0, 40));

    const systemPrompt = CHAT_SYSTEM_PROMPT
      .replace('{preferences}',    prefsText)
      .replace('{recommendations}', shownText)
      .replace('{catalog}',         catalogText);

    // Build history in OpenRouter format (role: user/assistant only)
    const historyMessages = (Array.isArray(history) ? history : [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .map(m => ({ role: m.role, content: String(m.content) }));

    const reply = await callLLM(systemPrompt, message, historyMessages, 600);

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ message: reply }),
    };
  } catch (err) {
    console.error('chat error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message }),
    };
  }
};
