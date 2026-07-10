/**
 * Composio Research Pipeline Runner
 * 
 * Orchestrates: 1) AI Research → 2) Web Verification → 3) Pattern Analysis
 * 
 * Usage:
 *   node src/pipeline-runner.js         # Research phase (needs ANTHROPIC_API_KEY)
 *   node src/pipeline-runner.js --full   # Full pipeline (research + verify + analyze)
 *   node src/pipeline-runner.js --build  # Build from knowledge data (no API key needed)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'output');

function log(phase, msg) {
  console.log(`[${phase}] ${msg}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  const args = process.argv.slice(2);
  const fullPipeline = args.includes('--full');
  const buildOnly = args.includes('--build');
  
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     Composio App Research Pipeline v1.0     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log();
  
  ensureDir(OUTPUT);
  
  if (buildOnly || fullPipeline) {
    // Phase 1: Build research data from knowledge
    log('PHASE 1', 'Building research data from AI knowledge...');
    try {
      const { RESEARCH_DATA } = require('./build-research-data');
      log('PHASE 1', `✓ ${RESEARCH_DATA.length} apps researched`);
      
      // Phase 2: Verify on sample
      log('PHASE 2', 'Running verification on 20-app sample...');
      const { runVerification } = require('./verification-agent');
      const verification = await runVerification(RESEARCH_DATA);
      log('PHASE 2', `✓ Accuracy: ${verification.report.metrics.overall_accuracy}%`);
      
      // Phase 3: Analyze patterns
      log('PHASE 3', 'Running pattern analysis...');
      const { analyzePatterns } = require('./build-research-data');
      const patterns = analyzePatterns(RESEARCH_DATA);
      
      console.log('\n══════════════════════════════════════════════');
      console.log('  PIPELINE COMPLETE');
      console.log('══════════════════════════════════════════════');
      console.log(`  Total apps: ${RESEARCH_DATA.length}`);
      console.log(`  Self-serve: ${patterns.self_serve_pct}%`);
      console.log(`  Buildable:  ${patterns.buildable_pct}%`);
      console.log(`  Have MCP:   ${patterns.mcp_pct}%`);
      console.log(`  Accuracy:   ${verification.report.metrics.overall_accuracy}%`);
      console.log(`\n  Output: output/research-results-final.json`);
      console.log(`          output/research-summary.csv`);
      console.log(`          output/verification-results.json`);
      console.log(`          output/index.html`);
      
    } catch (e) {
      log('ERROR', e.message);
      process.exit(1);
    }
    
  } else if (args.includes('--research')) {
    // Run AI-powered research
    log('PHASE 1', 'Running AI-powered research...');
    require('./knowledge-research').runResearch().then(results => {
      fs.writeFileSync(path.join(OUTPUT, 'knowledge-research.json'), JSON.stringify(results, null, 2));
      log('DONE', `${results.length} apps researched.`);
    }).catch(e => { log('ERROR', e.message); process.exit(1); });
    
  } else {
    console.log('Usage: node src/pipeline-runner.js [--build | --full | --research]');
    console.log();
    console.log('  --build     Build research data from knowledge (no API key needed)');
    console.log('  --full      Full pipeline: knowledge + verification + analysis');
    console.log('  --research  Run AI-powered research (needs ANTHROPIC_API_KEY)');
    console.log();
    console.log('Quick start (no API key):');
    console.log('  npm run analyze');
    console.log('  npm run pipeline');
    console.log();
    console.log('Then open:');
    console.log('  output/index.html');
  }
}

main().catch(console.error);
