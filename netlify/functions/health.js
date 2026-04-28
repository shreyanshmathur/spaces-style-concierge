'use strict';
const { corsHeaders } = require('./_shared');

exports.handler = async () => ({
  statusCode: 200,
  headers: corsHeaders(),
  body: JSON.stringify({ status: 'ok', service: 'SPACES Style Concierge', runtime: 'netlify-functions' }),
});
