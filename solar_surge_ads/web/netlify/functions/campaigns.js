/**
 * GET /api/campaigns
 * Returns all campaigns from the FB ad account, grouped by SGS / HES / other.
 * Also fetches ad sets and ads nested under each campaign.
 */

const FB  = 'https://graph.facebook.com/v21.0';
const TOKEN  = process.env.FACEBOOK_ACCESS_TOKEN;
const ACCOUNT = process.env.AD_ACCOUNT_ID;

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

async function fb(path, params = {}) {
  const qs = new URLSearchParams({ access_token: TOKEN, ...params }).toString();
  const res = await fetch(`${FB}/${path}?${qs}`);
  const json = await res.json();
  if (json.error) throw new Error(`FB API: ${json.error.message}`);
  return json;
}

exports.handler = async () => {
  if (!TOKEN || !ACCOUNT) {
    return { statusCode: 500, headers,
      body: JSON.stringify({ error: 'FACEBOOK_ACCESS_TOKEN or AD_ACCOUNT_ID not set in Netlify env vars.' }) };
  }

  try {
    // Fetch campaigns
    const camData = await fb(`${ACCOUNT}/campaigns`, {
      fields: 'id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time,spend_cap',
      limit: 50,
    });
    const campaigns = camData.data || [];

    // For each campaign, fetch ad sets + ads in parallel
    const enriched = await Promise.all(campaigns.map(async (camp) => {
      const [adSetsData, adsData] = await Promise.all([
        fb(`${camp.id}/adsets`, {
          fields: 'id,name,status,daily_budget,optimization_goal,targeting,created_time',
          limit: 20,
        }),
        fb(`${camp.id}/ads`, {
          fields: 'id,name,status,created_time',
          limit: 20,
        }),
      ]);
      return {
        ...camp,
        ad_sets: adSetsData.data || [],
        ads: adsData.data || [],
      };
    }));

    // Group by client prefix
    const sgs   = enriched.filter(c => c.name.startsWith('SGS'));
    const hes   = enriched.filter(c => c.name.startsWith('HES'));
    const other = enriched.filter(c => !c.name.startsWith('SGS') && !c.name.startsWith('HES'));

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ all: enriched, grouped: { sgs, hes, other } }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
