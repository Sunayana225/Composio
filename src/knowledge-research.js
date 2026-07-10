/**
 * Knowledge-based research phase.
 * Uses AI training knowledge as the primary research source,
 * then web verification on a sample as the accuracy check.
 * 
 * This script produces the structured research data for all 100 apps.
 * A second phase (research-agent.js) would run the web verification loop.
 */

const fs = require('fs');
const path = require('path');
const { Anthropic } = require('@anthropic-ai/sdk');
const { APPS_BY_CATEGORY } = require('./apps-data');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runResearch() {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const outputDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const allResults = [];

  for (const [category, apps] of Object.entries(APPS_BY_CATEGORY)) {
    const appsList = apps.map(a => `  ${a.id}. ${a.name} (${a.website})`).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are a precise research analyst for Composio, which turns apps into tools AI agents can call.
Return ONLY a valid JSON array matching the specified schema. No markdown, no explanation.`,
      messages: [{
        role: 'user',
        content: `Research these ${apps.length} apps in the "${category}" category for an AI agent toolkit platform.

For each app, analyze:
1. What it does (one concise line)
2. Auth method(s): OAuth2, API Key, Basic Auth, Token, JWT, or other
3. Self-serve vs Gated: can a developer get free/trial credentials on their own?
4. API surface: documented public REST/GraphQL API? How broad? Any existing MCP?
5. Buildability: could this be an agent toolkit today? Main blocker if not?

Apps to research:\n${appsList}

Return JSON array with objects having these EXACT fields:
{
  "name": string,
  "category": string,
  "description": string (one concise line),
  "auth_methods": string[],
  "auth_details": string,
  "self_serve": "yes" | "no" | "partial" | "unknown",
  "gating_details": string,
  "api_surface_breadth": "none" | "narrow" | "medium" | "broad" | "unknown",
  "api_type": "REST" | "GraphQL" | "both" | "SDK-only" | "none" | "unknown",
  "has_mcp": "yes" | "no" | "unknown",
  "mcp_details": string,
  "buildable_now": "yes" | "no" | "partial",
  "main_blocker": string,
  "evidence_urls": string (comma-separated key URLs),
  "confidence": "high" | "medium" | "low"
}

Be specific and honest about uncertainty. Return ONLY the JSON array.`
      }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const results = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    allResults.push(...results);

    fs.writeFileSync(
      path.join(outputDir, 'checkpoint.json'),
      JSON.stringify(allResults, null, 2)
    );

    console.log(`✓ ${category}: ${results.length} apps done`);
    await new Promise(r => setTimeout(r, 1500));
  }

  return allResults;
}

// Also export for use by the pipeline runner
if (require.main === module) {
  runResearch()
    .then(results => {
      const output = { generated_at: new Date().toISOString(), total: results.length, results };
      fs.writeFileSync(
        path.join(__dirname, '..', 'output', 'knowledge-research.json'),
        JSON.stringify(output, null, 2)
      );
      console.log(`\nDone! ${results.length} apps researched.`);
    })
    .catch(console.error);
}

module.exports = { runResearch };
