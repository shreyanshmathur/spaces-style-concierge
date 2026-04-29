'use strict';
const {
  corsHeaders,
  callLLM,
  parseJsonObject,
  SMART_OFFER_SYSTEM_PROMPT,
} = require('./_shared');

const FREE_SHIPPING_THRESHOLD = 2000;

const HARDCODED_OFFERS = {
  gift_wrap: {
    offer_type: 'gift_wrap',
    headline:   'Complimentary Gift Wrapping',
    message:    'Your order qualifies for complimentary SPACES gift wrapping — the perfect finishing touch.',
    badge:      'Gift Ready',
  },
  shipping: {
    offer_type: 'shipping',
    headline:   'Free Shipping Unlocked',
    message:    'Your order qualifies for free pan-India delivery. A little something from us to you.',
    badge:      'Free Shipping',
  },
  topup: {
    offer_type: 'topup',
    headline:   'Almost There',
    message:    'Add a little more to your cart to unlock complimentary shipping across India.',
    badge:      'Free Shipping Soon',
  },
  browse_nudge: {
    offer_type: 'browse_nudge',
    headline:   'Take Your Time',
    message:    'Your Style Concierge is here whenever you need a hand finding the perfect piece.',
    badge:      null,
  },
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  try {
    const {
      cart_value      = 0,
      session_seconds = 0,
    } = JSON.parse(event.body || '{}');

    const topupAmount = Math.max(0, FREE_SHIPPING_THRESHOLD - cart_value);

    let offerType, context;

    if (cart_value >= 5000) {
      offerType = 'gift_wrap';
      context   = `Customer spent Rs.${cart_value}. Offer complimentary gift wrapping as a premium touch.`;
    } else if (cart_value >= FREE_SHIPPING_THRESHOLD) {
      offerType = 'shipping';
      context   = `Cart value Rs.${cart_value}. Free shipping is unlocked — celebrate this warmly.`;
    } else if (cart_value > 0 && topupAmount <= 800) {
      offerType = 'topup';
      context   = `Customer needs Rs.${topupAmount} more for free shipping (threshold Rs.${FREE_SHIPPING_THRESHOLD}). Gentle, warm nudge.`;
    } else if (session_seconds > 45 && cart_value === 0) {
      offerType = 'browse_nudge';
      context   = `Customer has been browsing for ${Math.floor(session_seconds)}s without adding to cart. Warm, unhurried welcome.`;
    } else {
      return {
        statusCode: 200,
        headers:    corsHeaders(),
        body:       JSON.stringify({ has_offer: false }),
      };
    }

    let offerData;
    try {
      const systemPrompt = SMART_OFFER_SYSTEM_PROMPT.replace('{context}', context);
      const raw = await callLLM(systemPrompt, 'Generate the offer message.', [], 250);
      offerData = parseJsonObject(raw);
    } catch {
      offerData = HARDCODED_OFFERS[offerType];
    }

    return {
      statusCode: 200,
      headers:    corsHeaders(),
      body:       JSON.stringify({ has_offer: true, ...offerData }),
    };
  } catch (err) {
    console.error('smart-offer error:', err);
    return {
      statusCode: 500,
      headers:    corsHeaders(),
      body:       JSON.stringify({ error: err.message }),
    };
  }
};
