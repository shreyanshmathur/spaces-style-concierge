'use strict';
const { CATALOG, corsHeaders } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  return {
    statusCode: 200,
    headers: corsHeaders(),
    body: JSON.stringify({ count: CATALOG.length, products: CATALOG }),
  };
};
