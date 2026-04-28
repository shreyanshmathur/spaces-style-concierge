'use strict';
const {
  corsHeaders,
  filterCatalog,
  catalogToPromptText,
  callLLM,
  parseJsonObject,
  RECOMMENDATION_SYSTEM_PROMPT,
} = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { bed_size, sleep_temp, fabric, style_vibe, budget_max } = body;

    const prefs = {
      bedSize:   bed_size   || 'No preference',
      sleepTemp: sleep_temp || 'No preference',
      fabric:    fabric     || 'No preference',
      styleVibe: style_vibe || 'No preference',
      budgetMax: budget_max || null,
    };

    // Filter catalog to a relevant subset, then extend to fill prompt
    let products = filterCatalog({
      bedSize:   prefs.bedSize   !== 'No preference' ? prefs.bedSize   : undefined,
      sleepTemp: prefs.sleepTemp !== 'No preference' ? prefs.sleepTemp : undefined,
      fabric:    prefs.fabric    !== 'No preference' ? prefs.fabric    : undefined,
      styleVibe: prefs.styleVibe !== 'No preference' ? prefs.styleVibe : undefined,
      maxResults: 20,
    });

    // Apply optional budget filter
    if (prefs.budgetMax) {
      const filtered = products.filter(p => (p.discountedPrice || p.price) <= prefs.budgetMax);
      if (filtered.length >= 3) products = filtered;
    }

    const catalogText  = catalogToPromptText(products);
    const prefsText    = Object.entries(prefs)
      .filter(([, v]) => v && v !== 'No preference' && v !== null)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    const systemPrompt = RECOMMENDATION_SYSTEM_PROMPT
      .replace('{preferences}', prefsText || 'No specific preferences stated.')
      .replace('{catalog}', catalogText);

    const raw  = await callLLM(systemPrompt, 'Please recommend 3 products based on the preferences above.', [], 1500);
    const json = parseJsonObject(raw);

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify(json),
    };
  } catch (err) {
    console.error('recommend error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message }),
    };
  }
};
