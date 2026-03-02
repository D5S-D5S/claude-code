/**
 * GET /api/insights?campaign_id=XXX&days=7
 * Returns ad-level performance metrics for all ads in a campaign.
 * Applies SCALE / WATCH / KILL verdict logic server-side.
 */

const FB    = 'https://graph.facebook.com/v21.0';
const TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

// ── Thresholds (match analyzer.py) ──────────────────────────────────────────
const MIN_IMP      = 500;
const CPL_SCALE    = 8.0;
const CPL_KILL     = 15.0;
const CTR_SCALE    = 1.5;
const CTR_KILL     = 1.0;

function getVerdict(impressions, cpl, ctr, leads) {
  if (impressions < MIN_IMP) {
    return {
      label: '⏳ GATHERING DATA',
      cls: 'pending',
      explanation: `Only ${impressions.toLocaleString()} impressions — need ${MIN_IMP - impressions} more before verdict.`,
    };
  }
  if (leads === 0) return { label: '❌ KILL', cls: 'kill', explanation: `${impressions.toLocaleString()} impressions, 0 leads. Creative not converting.` };
  if (ctr < CTR_KILL) return { label: '❌ KILL', cls: 'kill', explanation: `CTR ${ctr.toFixed(2)}% below 1% floor.` };
  if (cpl !== null && cpl > CPL_KILL) return { label: '❌ KILL', cls: 'kill', explanation: `CPL £${cpl.toFixed(2)} above £${CPL_KILL} kill threshold.` };
  if (cpl !== null && cpl <= CPL_SCALE && ctr >= CTR_SCALE) {
    return { label: '✅ SCALE', cls: 'scale', explanation: `CPL £${cpl.toFixed(2)} ✓ | CTR ${ctr.toFixed(2)}% ✓. Increase budget.` };
  }
  return { label: '⚠️ WATCH', cls: 'watch', explanation: `CPL ${cpl ? '£'+cpl.toFixed(2) : 'N/A'} | CTR ${ctr.toFixed(2)}%. Run 48hrs more.` };
}

async function fb(path, params = {}) {
  const qs = new URLSearchParams({ access_token: TOKEN, ...params }).toString();
  const res = await fetch(`${FB}/${path}?${qs}`);
  const json = await res.json();
  if (json.error) throw new Error(`FB API: ${json.error.message}`);
  return json;
}

exports.handler = async (event) => {
  const { campaign_id, days = '7' } = event.queryStringParameters || {};
  if (!campaign_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'campaign_id required' }) };

  try {
    // 1. Get all ads in this campaign
    const adsData = await fb(`${campaign_id}/ads`, {
      fields: 'id,name,status,creative{id,name,object_story_spec}',
      limit: 30,
    });
    const ads = adsData.data || [];
    if (!ads.length) return { statusCode: 200, headers, body: JSON.stringify({ ads: [] }) };

    // 2. Fetch insights for each ad
    const datePreset = {
      '3': 'last_3d', '7': 'last_7d', '14': 'last_14d', '30': 'last_30d'
    }[days] || 'last_7d';

    const insightsResults = await Promise.all(ads.map(ad =>
      fb(`${ad.id}/insights`, {
        fields: 'impressions,spend,ctr,actions,cost_per_action_type',
        date_preset: datePreset,
      }).catch(() => ({ data: [] }))
    ));

    // 3. Merge + compute verdicts
    const result = ads.map((ad, i) => {
      const row = insightsResults[i].data?.[0] || {};
      const impressions = parseInt(row.impressions || 0);
      const spend       = parseFloat(row.spend || 0);
      const ctr         = parseFloat(row.ctr || 0);

      const leads = (row.actions || []).reduce((sum, a) => {
        if (['lead', 'onsite_conversion.lead_grouped'].includes(a.action_type)) {
          return sum + parseInt(a.value || 0);
        }
        return sum;
      }, 0);

      const cpl = leads > 0 ? Math.round((spend / leads) * 100) / 100 : null;
      const verdict = getVerdict(impressions, cpl, ctr, leads);

      // Extract message from creative for ad copy preview
      const storySpec = ad.creative?.object_story_spec?.link_data || {};
      const message   = storySpec.message || '';
      const parts     = message.split('\n\n');

      return {
        id:          ad.id,
        name:        ad.name,
        status:      ad.status,
        verdict:     verdict.label,
        verdictCls:  verdict.cls,
        explanation: verdict.explanation,
        copy: {
          hook: parts[0] || '',
          body: parts.slice(1, -1).join('\n\n') || '',
          cta:  parts[parts.length - 1] || '',
          full: message,
        },
        metrics: { impressions, spend: Math.round(spend * 100) / 100, ctr: Math.round(ctr * 1000) / 1000, leads, cpl },
      };
    });

    const totalSpend  = result.reduce((s, a) => s + a.metrics.spend, 0);
    const totalLeads  = result.reduce((s, a) => s + a.metrics.leads, 0);
    const overallCPL  = totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : null;

    // Plain-English recommendation
    const kills  = result.filter(a => a.verdict.includes('KILL'));
    const scales = result.filter(a => a.verdict.includes('SCALE'));
    const watches= result.filter(a => a.verdict.includes('WATCH'));
    const pending= result.filter(a => a.verdict.includes('GATHERING'));
    const recParts = [];
    if (kills.length)  recParts.push(`Kill ${kills.map(a => a.name).join(', ')}.`);
    if (scales.length) recParts.push(`Scale ${scales.map(a => a.name).join(', ')} — reallocate budget from killed ads.`);
    if (watches.length) recParts.push(`Let ${watches.map(a => a.name).join(', ')} run 48hrs more.`);
    if (pending.length) recParts.push(`Still gathering data for ${pending.map(a => a.name).join(', ')}.`);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        campaign_id, days,
        ads: result,
        totals: { spend: Math.round(totalSpend * 100) / 100, leads: totalLeads, cpl: overallCPL },
        recommendation: recParts.join(' ') || 'Not enough data yet. Check after each ad hits 500 impressions.',
        counts: {
          scale: scales.length, watch: watches.length, kill: kills.length, pending: pending.length
        },
        thresholds: { min_impressions: MIN_IMP, cpl_scale: CPL_SCALE, cpl_kill: CPL_KILL, ctr_scale: CTR_SCALE, ctr_kill: CTR_KILL },
        fetched_at: new Date().toISOString(),
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
