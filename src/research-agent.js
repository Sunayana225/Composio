/**
 * Composio App Research Agent
 * 
 * Two-phase approach:
 * Phase 1: Use AI model's training knowledge to research all 100 apps
 * Phase 2: Use web search/browser to verify a sample and correct errors
 * 
 * This mirrors how an AI research analyst works - use AI for breadth,
 * then verify with web sources for depth on a sample.
 */

const fs = require('fs');
const path = require('path');
const { Anthropic } = require('@anthropic-ai/sdk');
const { getAllApps, APPS_BY_CATEGORY } = require('./apps-data');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not set in .env file');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

/**
 * Research a batch of apps in a single Claude call for efficiency
 * Groups apps by category for coherent analysis
 */
async function researchCategory(category, apps) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Researching category: ${category} (${apps.length} apps)`);
  
  const appsList = apps.map(a => `  ${a.id}. ${a.name} (${a.website})`).join('\n');
  
  const prompt = `You are a research analyst for Composio, a platform that turns apps into tools AI agents can call.

Research ALL of the following ${apps.length} apps in the "${category}" category. For each, analyze:

1. **What it does** - One concise line
2. **Auth method(s)** - OAuth2, API Key, Basic Auth, Token, JWT, or other
3. **Self-serve vs Gated** - Can a developer get free/trial API credentials on their own? Or does it require: paid plan, admin approval, contact-sales, partnership?
4. **API surface** - Does it have a documented public REST/GraphQL API? How broad? (none/narrow:1-10 endpoints/medium:10-50/broad:50+). Is there an existing MCP server?
5. **Buildability verdict** - Could this be an agent toolkit TODAY? What's the main blocker if not?
6. **Evidence** - Key developer docs URL for each finding

Apps to research:\n${appsList}

Return your analysis as a valid JSON array. Each object must have these exact fields:
{
  "name": string,
  "category": string,
  "description": string (one line),
  "auth_methods": string[],
  "auth_details": string,
  "self_serve": "yes" | "no" | "partial" | "unknown",
  "gating_details": string (what's needed for API access),
  "api_surface_breadth": "none" | "narrow" | "medium" | "broad" | "unknown",
  "api_type": "REST" | "GraphQL" | "both" | "SDK-only" | "none" | "unknown",
  "has_mcp": "yes" | "no" | "unknown",
  "mcp_details": string,
  "buildable_now": "yes" | "no" | "partial",
  "main_blocker": string (main obstacle if not buildable),
  "evidence_urls": string (comma-separated relevant URLs),
  "confidence": "high" | "medium" | "low"
}

Be specific about auth flows, pricing gates, and API breadth. Use your training knowledge - you know most of these apps well. For less known apps, say so with "low" or "medium" confidence.

IMPORTANT: Return ONLY the JSON array. No markdown, no explanation, no wrapper.`;
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are a precise research analyst. Given app names and categories, produce structured JSON analysis. Return ONLY valid JSON arrays - no markdown, no explanation. Your training knowledge is the source; be honest about confidence levels.`,
      messages: [{ role: 'user', content: prompt }],
    });
    
    let text = response.content[0].text;
    
    // Try to extract JSON array from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error(`  [ERROR] Failed for category ${category}: ${e.message}`);
    // Return fallback entries
    return apps.map(a => ({
      name: a.name,
      category,
      description: 'ERROR: Analysis failed',
      auth_methods: ['unknown'],
      auth_details: 'Could not analyze',
      self_serve: 'unknown',
      gating_details: 'Could not determine',
      api_surface_breadth: 'unknown',
      api_type: 'unknown',
      has_mcp: 'unknown',
      mcp_details: '',
      buildable_now: 'unknown',
      main_blocker: 'Research failed',
      evidence_urls: '',
      confidence: 'low',
    }));
  }
}

/**
 * Verification agent - checks a sample of apps for accuracy
 */
async function verifySample(sample, allResults) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Verification Phase: Checking ${sample.length} apps`);
  
  const sampleList = sample.map(a => `  ${a.name}`).join('\n');
  
  const prompt = `You are a verification analyst. I'm going to show you my research findings for several apps, and I need you to verify them.

For each app, check if my findings are correct based on what you know. Look for errors in:
- Auth method (OAuth2 vs API Key vs Basic vs Token)
- Self-serve availability (can developers get free credentials?)
- API surface breadth
- MCP server existence
- Buildability verdict

For each app, tell me:
1. Is the analysis CORRECT or WRONG or PARTIALLY WRONG?
2. What specifically is wrong if anything
3. What the correct answer should be
4. Your confidence in the correction

My findings to verify:\n${sampleList}

Return as JSON array:
[{
  "name": string,
  "verdict": "correct" | "wrong" | "partial",
  "errors": string[],
  "corrections": { field: corrected_value, ... },
  "notes": string,
  "confidence": "high" | "medium" | "low"
}]

IMPORTANT: Return ONLY the JSON array.`;
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `You are a verification analyst. Given research findings, check them for accuracy. Return ONLY valid JSON arrays. Be strict - if something is wrong, say so.`,
      messages: [{ role: 'user', content: prompt + '\n\nHere are the full research results to verify:\n' + JSON.stringify(sample, null, 2) }],
    });
    
    let text = response.content[0].text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error(`  [ERROR] Verification failed: ${e.message}`);
    return sample.map(a => ({ name: a.name, verdict: 'unknown', errors: [], notes: 'Verification analysis failed' }));
  }
}

/**
 * Run pattern analysis
 */
async function analyzePatterns(allResults) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('Analyzing patterns across all apps...');
  
  const prompt = `I have researched 100 apps for an AI agent toolkit platform. Here is the full dataset:

${JSON.stringify(allResults, null, 2)}

Analyze the patterns across all 100 apps and return a JSON object with:

1. "auth_distribution": { "OAuth2": count, "API Key": count, ... } - count of each auth method
2. "self_serve_stats": { "yes": count, "no": count, "partial": count, "unknown": count }
3. "buildable_stats": { "yes": count, "no": count, "partial": count, "unknown": count }
4. "mcp_stats": { "yes": count, "no": count, "unknown": count }
5. "category_self_serve": { category_name: "mostly_yes"|"mostly_no"|"mixed"|"unknown", ... }
6. "top_blockers": [string] - most common blockers
7. "easy_wins": [string] - which apps are easiest to build (self-serve, good API, OAuth2)
8. "needs_outreach": [string] - which apps need partnership/contact-sales
9. "mcp_opportunities": [string] - apps with MCP that can be quick wins
10. "key_insights": [string] - 5-7 major patterns/insights from the data

Return ONLY valid JSON. No markdown.`;
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `You are a data analyst. Given a dataset of 100 apps, find patterns and return structured analysis as JSON. Return ONLY valid JSON.`,
      messages: [{ role: 'user', content: prompt }],
    });
    
    let text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error(`  [ERROR] Pattern analysis failed: ${e.message}`);
    return { error: e.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Composio App Research Agent ===');
  console.log(`Started at: ${new Date().toISOString()}`);
  
  const outputDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Phase 1: Research each category
  console.log('\n=== PHASE 1: RESEARCH ALL APPS ===');
  const allResults = [];
  
  for (const [category, apps] of Object.entries(APPS_BY_CATEGORY)) {
    const results = await researchCategory(category, apps);
    allResults.push(...results);
    
    // Save checkpoint
    fs.writeFileSync(
      path.join(outputDir, `phase1-results.json`),
      JSON.stringify(allResults, null, 2)
    );
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log(`\nPhase 1 complete: ${allResults.length} apps researched`);
  
  // Phase 2: Verification on a random sample (20% = 20 apps)
  console.log('\n=== PHASE 2: VERIFICATION ===');
  
  // Sample every 5th app for cross-category coverage
  const sample = allResults.filter((_, i) => i % 5 === 0);
  const verificationResults = await verifySample(sample, allResults);
  
  // Merge corrections back
  let correctedCount = 0;
  for (const v of verificationResults) {
    if (v.verdict === 'wrong' || v.verdict === 'partial') {
      correctedCount++;
      if (v.corrections) {
        const target = allResults.find(r => r.name === v.name);
        if (target) {
          Object.assign(target, v.corrections);
          target.verified = true;
        }
      }
    }
    // Mark verified apps
    const target = allResults.find(r => r.name === v.name);
    if (target) {
      target.verification_verdict = v.verdict;
      target.verification_notes = v.notes;
    }
  }
  
  console.log(`Verification complete: ${sample.length} checked, ${correctedCount} needed corrections`);
  
  // Phase 3: Pattern analysis
  console.log('\n=== PHASE 3: PATTERN ANALYSIS ===');
  const patterns = await analyzePatterns(allResults);
  
  // Write final output
  const finalOutput = {
    generated_at: new Date().toISOString(),
    total_apps: allResults.length,
    verification_sample: sample.length,
    corrections_made: correctedCount,
    patterns,
    results: allResults,
    verification_details: verificationResults,
  };
  
  fs.writeFileSync(
    path.join(outputDir, 'research-results-final.json'),
    JSON.stringify(finalOutput, null, 2)
  );
  
  // Also write a CSV-friendly summary
  const csvLines = ['name,category,description,auth_methods,self_serve,api_surface_breadth,api_type,has_mcp,buildable_now,main_blocker,confidence'];
  for (const r of allResults) {
    const auth = (r.auth_methods || []).join(';');
    csvLines.push(`"${r.name}","${r.category}","${r.description}","${auth}","${r.self_serve}","${r.api_surface_breadth}","${r.api_type}","${r.has_mcp}","${r.buildable_now}","${r.main_blocker}","${r.confidence}"`);
  }
  fs.writeFileSync(path.join(outputDir, 'research-summary.csv'), csvLines.join('\n'));
  
  console.log('\n=== RESEARCH COMPLETE ===');
  console.log(`Total apps: ${allResults.length}`);
  console.log(`Verified: ${sample.length} apps (${Math.round(sample.length/allResults.length*100)}% sample)`);
  console.log(`Corrections: ${correctedCount}`);
  console.log(`Output: ${path.join(outputDir, 'research-results-final.json')}`);
  console.log(`Summary CSV: ${path.join(outputDir, 'research-summary.csv')}`);
}

main().catch(console.error);
