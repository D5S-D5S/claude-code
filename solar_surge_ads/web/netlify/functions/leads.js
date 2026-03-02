/**
 * GET /api/leads?form_id=XXX&limit=50
 * Returns leads captured from a Facebook Instant Form.
 * Also accepts campaign_id to auto-discover the form from ads.
 */

const FB    = 'https://graph.facebook.com/v21.0';
const TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const PAGE_ID = process.env.PAGE_ID;
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

async function fb(path, params = {}) {
  const qs = new URLSearchParams({ access_token: TOKEN, ...params }).toString();
  const res = await fetch(`${FB}/${path}?${qs}`);
  const json = await res.json();
  if (json.error) throw new Error(`FB API: ${json.error.message}`);
  return json;
}

function parseLeadFields(fieldData) {
  const out = {};
  for (const item of fieldData || []) {
    out[item.name] = Array.isArray(item.values) ? item.values[0] : item.values;
  }
  return out;
}

exports.handler = async (event) => {
  const { form_id, campaign_id, limit = '100' } = event.queryStringParameters || {};

  try {
    let formIds = [];

    if (form_id) {
      formIds = [form_id];
    } else if (campaign_id) {
      // Discover form IDs from ads in this campaign
      const adsData = await fb(`${campaign_id}/ads`, {
        fields: 'creative{object_story_spec}',
        limit: '30',
      });
      const seen = new Set();
      for (const ad of adsData.data || []) {
        const cta = ad.creative?.object_story_spec?.link_data?.call_to_action?.value;
        if (cta?.lead_gen_form_id && !seen.has(cta.lead_gen_form_id)) {
          seen.add(cta.lead_gen_form_id);
          formIds.push(cta.lead_gen_form_id);
        }
      }
      if (!formIds.length) {
        return { statusCode: 200, headers, body: JSON.stringify({ leads: [], total: 0, message: 'No lead form found on ads yet.' }) };
      }
    } else if (PAGE_ID) {
      // Fallback: list all forms on the page
      const formsData = await fb(`${PAGE_ID}/leadgen_forms`, {
        fields: 'id,name,status,leads_count',
        limit: '10',
      });
      formIds = (formsData.data || []).map(f => f.id);
    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'form_id, campaign_id, or PAGE_ID env var required' }) };
    }

    // Fetch leads from all discovered forms
    const allLeads = [];
    const formMeta = [];

    for (const fid of formIds) {
      const [leadsData, formInfo] = await Promise.all([
        fb(`${fid}/leads`, {
          fields: 'id,created_time,field_data,ad_name,adset_name,campaign_name',
          limit,
        }),
        fb(fid, { fields: 'id,name,status,leads_count' }).catch(() => ({ id: fid })),
      ]);

      formMeta.push(formInfo);
      for (const lead of leadsData.data || []) {
        allLeads.push({
          id:          lead.id,
          created_at:  lead.created_time,
          ad_name:     lead.ad_name || '',
          adset_name:  lead.adset_name || '',
          campaign_name: lead.campaign_name || '',
          form_id:     fid,
          fields:      parseLeadFields(lead.field_data),
        });
      }
    }

    // Sort newest first
    allLeads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        leads:    allLeads,
        total:    allLeads.length,
        forms:    formMeta,
        fetched_at: new Date().toISOString(),
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
