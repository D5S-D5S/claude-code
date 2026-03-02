/**
 * GET /api/history?ad_id=XXX&days=7
 * Returns a daily performance breakdown for a single ad (for chart rendering).
 */

const FB    = 'https://graph.facebook.com/v21.0';
const TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

async function fb(path, params = {}) {
  const qs = new URLSearchParams({ access_token: TOKEN, ...params }).toString();
  const res = await fetch(`${FB}/${path}?${qs}`);
  const json = await res.json();
  if (json.error) throw new Error(`FB API: ${json.error.message}`);
  return json;
}

exports.handler = async (event) => {
  const { ad_id, days = '7' } = event.queryStringParameters || {};
  if (!ad_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'ad_id required' }) };

  const datePreset = {
    '3': 'last_3d', '7': 'last_7d', '14': 'last_14d', '30': 'last_30d'
  }[days] || 'last_7d';

  try {
    const data = await fb(`${ad_id}/insights`, {
      fields: 'date_start,date_stop,impressions,spend,ctr,actions,reach,frequency',
      date_preset: datePreset,
      time_increment: '1',
    });

    const history = (data.data || []).map(row => {
      const leads = (row.actions || []).reduce((s, a) =>
        ['lead', 'onsite_conversion.lead_grouped'].includes(a.action_type) ? s + parseInt(a.value || 0) : s, 0);
      const spend = parseFloat(row.spend || 0);
      return {
        date:        row.date_start,
        impressions: parseInt(row.impressions || 0),
        reach:       parseInt(row.reach || 0),
        frequency:   parseFloat(row.frequency || 0),
        spend:       Math.round(spend * 100) / 100,
        ctr:         Math.round(parseFloat(row.ctr || 0) * 1000) / 1000,
        leads,
        cpl:         leads > 0 ? Math.round((spend / leads) * 100) / 100 : null,
      };
    });

    // Totals across the period
    const totals = history.reduce((acc, d) => ({
      impressions: acc.impressions + d.impressions,
      spend:       Math.round((acc.spend + d.spend) * 100) / 100,
      leads:       acc.leads + d.leads,
    }), { impressions: 0, spend: 0, leads: 0 });
    totals.cpl = totals.leads > 0 ? Math.round((totals.spend / totals.leads) * 100) / 100 : null;
    totals.avg_ctr = history.length
      ? Math.round((history.reduce((s, d) => s + d.ctr, 0) / history.length) * 1000) / 1000
      : 0;

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ ad_id, days, history, totals, fetched_at: new Date().toISOString() }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
