'use strict';
const {
  corsHeaders,
  filterCatalog,
  catalogToPromptText,
  callVisionLLM,
  parseJsonObject,
  ROOM_ANALYSIS_SYSTEM_PROMPT,
} = require('./_shared');

// Netlify Functions cap request body at 6 MB (base64 image should be fine for typical room photos)
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  try {
    const body     = JSON.parse(event.body || '{}');
    const { image_base64, image_mime = 'image/jpeg', bed_size } = body;

    if (!image_base64) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'image_base64 is required' }),
      };
    }

    const products    = filterCatalog({ bedSize: bed_size || undefined, maxResults: 24 });
    const catalogText = catalogToPromptText(products);

    const systemPrompt = ROOM_ANALYSIS_SYSTEM_PROMPT
      .replace('{bedSize}', bed_size || 'any size')
      .replace('{catalog}', catalogText);

    const raw  = await callVisionLLM(systemPrompt, image_base64, image_mime, 'Analyse this room and recommend products.', 1500);
    const json = parseJsonObject(raw);

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify(json),
    };
  } catch (err) {
    console.error('analyze-room error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message }),
    };
  }
};
