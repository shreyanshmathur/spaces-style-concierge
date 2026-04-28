'use strict';
const {
  corsHeaders,
  relatedProducts,
  relatedReason,
  productCardFromCatalog,
  findProduct,
} = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  try {
    const body       = JSON.parse(event.body || '{}');
    const selectedSku = body.selected_sku || null;
    const cartSkus    = Array.isArray(body.cart_skus) ? body.cart_skus : [];
    const limit       = Math.min(parseInt(body.limit || '4', 10), 8);

    const { intro, products } = relatedProducts(selectedSku, cartSkus, limit);
    const selected            = selectedSku ? findProduct(selectedSku) : null;

    const cards = products.map(p => ({
      ...productCardFromCatalog(p, relatedReason(p, selected), 'medium'),
    }));

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ intro, recommendations: cards }),
    };
  } catch (err) {
    console.error('related-products error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message }),
    };
  }
};
