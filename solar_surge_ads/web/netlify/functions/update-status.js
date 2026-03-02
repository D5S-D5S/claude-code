/**
 * POST /api/update-status
 * Body: { id: "ad_id|adset_id|campaign_id", type: "ad|adset|campaign", status: "PAUSED|ACTIVE" }
 * Pauses or enables a Facebook ad, ad set, or campaign.
 *
 * SAFETY: Only allows toggling between PAUSED and ACTIVE.
 * Will never DELETE or permanently change anything.
 */

const FB    = 'https://graph.facebook.com/v21.0';
const TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

const ALLOWED_STATUSES = new Set(['PAUSED', 'ACTIVE']);

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST required' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) }; }

  const { id, status } = body;

  if (!id || !status) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'id and status are required' }) };
  }
  if (!ALLOWED_STATUSES.has(status)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `status must be PAUSED or ACTIVE` }) };
  }

  try {
    const res = await fetch(`${FB}/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: TOKEN, status }),
    });
    const json = await res.json();

    if (json.error) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: json.error.message }) };
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, id, status, updated_at: new Date().toISOString() }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
