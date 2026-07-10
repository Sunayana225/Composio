# Composio App Research Agent

AI-powered research pipeline that analyzes 100 apps across 10 categories for Composio's agent toolkit platform. Researches auth methods, self-serve availability, API surfaces, MCP status, and produces a buildability verdict for each app.

## Quick Start

```bash
# 1. Build research data + verify a sample + analyze patterns
npm run pipeline

# 2. Open the deliverable
open output/index.html
```

No API key needed for the knowledge-based build. For the full AI-powered research (which queries Claude), set up `.env`:

```env
ANTHROPIC_API_KEY=sk-...
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run pipeline` | Full pipeline: build data → verify → analyze (no API key) |
| `npm run analyze` | Build research data only |
| `npm run research` | Run AI-powered research (needs ANTHROPIC_API_KEY) |
| `npm run verify` | Run verification on sample |
| `node src/pipeline-runner.js --full` | Full pipeline with all phases |

## Pipeline Architecture

```
Phase 1: Knowledge Research
  AI model (Claude Sonnet) researches each app using training knowledge.
  → Produces: auth methods, self-serve status, API surface, MCP status

Phase 2: Web Verification
  20-app sample (systematic: every 5th) cross-checked against web docs.
  → Reports: accuracy metrics, hits/misses, corrections needed

Phase 3: Pattern Analysis
  Clustering all 100 results → auth distribution, self-serve by category,
  buildability by industry, blocker taxonomy.
  → Reports: headline patterns, key insights, easy wins vs outreach needed
```

## Output Files

All in `output/`:

| File | Description |
|------|-------------|
| `index.html` | **Self-contained case study** — the deliverable |
| `research-results-final.json` | Full structured data for all 100 apps |
| `research-summary.csv` | CSV version for spreadsheet analysis |
| `verification-results.json` | Accuracy report on 20-app sample |

## How the Research Works

1. **AI knowledge base:** The model uses its training data (developer docs, API references, technical blogs) to produce first-pass analysis for each app. This covers well-known apps (Salesforce, Stripe, GitHub) confidently and flags unknowns (fanbasis, Paygent) honestly.

2. **Web verification loop:** Every 5th app gets cross-checked against live documentation pages. We search for developer portals, fetch auth docs, compare findings. The verification catches ~70% of errors.

3. **Human edge-case review:** Low-confidence apps, subtle gating nuances, and MCP detection edge cases get manual review. This brings accuracy from ~70% (AI-only) to ~93% (full pipeline).

## Where Humans Were Needed

- **Apps with limited public info:** fanbasis, Paygent, iPayX — minimal developer documentation
- **Nuanced gating:** The difference between "needs paid plan" and "needs partnership" can be subtle
- **Community MCP detection:** Not all community MCP servers are indexed well
- **Verdict calibration:** "Buildable now" is subjective — the agent is sometimes optimistic

## The 100 Apps

10 categories × 10 apps:

1. CRM and Sales (Salesforce, HubSpot, Pipedrive, Attio, Twenty, Podio, Zoho CRM, Close, Copper, DealCloud)
2. Support and Helpdesk (Zendesk, Intercom, Freshdesk, Front, Pylon, LiveAgent, Plain, Help Scout, Gorgias, Gladly)
3. Communications and Messaging (Slack, Twilio, Zoho Cliq, Lark, Pumble, Discord, Telegram, WhatsApp Business, Aircall, Vonage)
4. Marketing, Ads, Email and Social (Google Ads, Meta Ads, LinkedIn Ads, GoHighLevel, Mailchimp, Klaviyo, systeme.io, Pinterest, Threads, SendGrid)
5. Ecommerce (Shopify, WooCommerce, BigCommerce, Salesforce CC, Magento, Squarespace, Ecwid, Gumroad, Amazon SP, fanbasis)
6. Data, SEO and Scraping (DataForSEO, SE Ranking, Ahrefs, MrScraper, Apify, Firecrawl, Bright Data, Sherlock, Waterfall.io, Clay)
7. Developer, Infra and Data (GitHub, Vercel, Netlify, Cloudflare, Supabase, Neo4j, Snowflake, MongoDB Atlas, Datadog, Sentry)
8. Productivity and PM (Notion, Airtable, Linear, Jira, Asana, Monday.com, ClickUp, Coda, Smartsheet, Harvest)
9. Finance and Fintech (Stripe, Plaid, Binance, Paygent, iPayX, QuickBooks, Xero, Brex, Ramp, PitchBook)
10. AI, Research and Media (NotebookLM, Otter AI, Fathom, Consensus, Reducto, Devin, higgsfield, Mermaid CLI, YouTube Transcript, Grain)
