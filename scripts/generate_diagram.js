const puppeteer = require('/Users/vaibhav/agentgate/node_modules/.pnpm/puppeteer-core@25.16.0/node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 850, deviceScaleFactor: 2 });

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; }
  body {
    background: #090d16;
    color: #e2e8f0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 30px;
    height: 100vh;
  }
  .header {
    text-align: center;
    margin-bottom: 24px;
  }
  .header h1 {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .header p {
    font-size: 14px;
    color: #94a3b8;
    margin-top: 4px;
  }
  .container {
    display: grid;
    grid-template-columns: 290px 48px 380px 48px 360px;
    align-items: center;
    gap: 0;
    width: 100%;
    max-width: 1320px;
  }
  .card {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    padding: 18px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  }
  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid #1e293b;
  }
  .card-header h2 {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #cbd5e1;
  }
  .badge {
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 10px;
    font-weight: 600;
  }
  .badge-blue { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
  .badge-purple { background: rgba(192, 132, 252, 0.15); color: #c084fc; border: 1px solid rgba(192, 132, 252, 0.3); }
  .badge-emerald { background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); }
  
  .item {
    background: #1e293b;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 10px;
    border-left: 3px solid #38bdf8;
  }
  .item:last-child { margin-bottom: 0; }
  .item-title { font-size: 12px; font-weight: 600; color: #f1f5f9; display: flex; justify-content: space-between; }
  .item-desc { font-size: 11px; color: #94a3b8; margin-top: 3px; font-family: ui-monospace, Menlo, monospace; }

  .compiler-box {
    border-color: #312e81;
    background: linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%);
  }
  .runtime-box {
    border-color: #064e3b;
    background: linear-gradient(180deg, #0f172a 0%, #064e3b22 100%);
  }

  .arrow-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-size: 20px;
  }
  .arrow-line {
    width: 100%;
    height: 2px;
    background: linear-gradient(90deg, #334155, #64748b);
    position: relative;
  }
  .arrow-line::after {
    content: "▶";
    position: absolute;
    right: -4px;
    top: -8px;
    font-size: 10px;
    color: #94a3b8;
  }

  .step-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid #334155;
    border-radius: 6px;
    margin-bottom: 8px;
    font-size: 11px;
  }
  .step-num {
    background: #4f46e5;
    color: white;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
  }

  .contract-pill {
    background: #020617;
    border: 1px dashed #6366f1;
    border-radius: 8px;
    padding: 12px;
    margin-top: 10px;
    text-align: center;
  }
  .contract-pill code {
    color: #a5b4fc;
    font-size: 12px;
    font-family: ui-monospace, Menlo, monospace;
    font-weight: 600;
  }

  .verdict-box {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 10px;
  }
  .verdict-tag {
    padding: 8px;
    border-radius: 6px;
    text-align: center;
    font-size: 11px;
    font-weight: 700;
  }
  .verdict-allow { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
  .verdict-block { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }

  .footer-meta {
    margin-top: 20px;
    display: flex;
    gap: 24px;
    font-size: 11px;
    color: #64748b;
  }
  .footer-meta span { display: flex; align-items: center; gap: 5px; }
  .footer-meta strong { color: #cbd5e1; }
</style>
</head>
<body>

<div class="header">
  <h1>AgentPact: Technical Architecture Pipeline</h1>
  <p>How code ASTs and business rules are compiled into a 0.013ms deterministic execution hypervisor</p>
</div>

<div class="container">

  <!-- COLUMN 1: INPUTS -->
  <div class="card">
    <div class="card-header">
      <h2>1. Raw Inputs</h2>
      <span class="badge badge-blue">Local Codebase</span>
    </div>
    
    <div class="item" style="border-left-color: #38bdf8;">
      <div class="item-title">
        <span>Backend Routes</span>
        <span style="color: #64748b;">TypeScript</span>
      </div>
      <div class="item-desc">routes/refunds.ts</div>
      <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">• order.status !== "DELIVERED"<br>• daysSinceDelivery > 14<br>• amount_cents > totalPaid</div>
    </div>

    <div class="item" style="border-left-color: #818cf8;">
      <div class="item-title">
        <span>MCP Tool Schemas</span>
        <span style="color: #64748b;">JSON / Zod</span>
      </div>
      <div class="item-desc">mcp/tools.ts</div>
      <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">• get_order({ orderId })<br>• issue_refund({ amount_cents })<br>• add_wallet_credit(...)</div>
    </div>

    <div class="item" style="border-left-color: #c084fc;">
      <div class="item-title">
        <span>System Prompt</span>
        <span style="color: #64748b;">Markdown</span>
      </div>
      <div class="item-desc">agent/prompt.md</div>
      <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">• "Never combine refund & credit"<br>• "Refunds > $50 need manager"<br>• "Max $100 budget per 24 hours"</div>
    </div>
  </div>

  <!-- ARROW 1 -->
  <div class="arrow-col">
    <div class="arrow-line"></div>
  </div>

  <!-- COLUMN 2: COMPILER -->
  <div class="card compiler-box">
    <div class="card-header">
      <h2>2. @agentpact/compiler</h2>
      <span class="badge badge-purple">Offline CLI (150ms)</span>
    </div>

    <div class="step-pill">
      <div class="step-num">A</div>
      <div>
        <div style="font-weight: 600; color: #e2e8f0;">ts-morph AST Parser</div>
        <div style="font-size: 10px; color: #94a3b8;">Extracts IfStatements & strips comments/decoys</div>
      </div>
    </div>

    <div class="step-pill">
      <div class="step-num">B</div>
      <div>
        <div style="font-weight: 600; color: #e2e8f0;">Unit Normalization Engine</div>
        <div style="font-size: 10px; color: #94a3b8;">Converts $50 prompt ➔ 5000 cents tool parameter</div>
      </div>
    </div>

    <div class="step-pill">
      <div class="step-num">C</div>
      <div>
        <div style="font-weight: 600; color: #e2e8f0;">Reciprocal Anti-Stacking Binder</div>
        <div style="font-size: 10px; color: #94a3b8;">Maps mutual exclusion across refund & credit tools</div>
      </div>
    </div>

    <div class="step-pill">
      <div class="step-num">D</div>
      <div>
        <div style="font-weight: 600; color: #e2e8f0;">Zod Schema Validation</div>
        <div style="font-size: 10px; color: #94a3b8;">AgentPactContractSchema.parse(rawContract)</div>
      </div>
    </div>

    <div class="contract-pill">
      <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">OUTPUT ARTIFACT</div>
      <code>agentpact.contract.json</code>
    </div>
  </div>

  <!-- ARROW 2 -->
  <div class="arrow-col">
    <div class="arrow-line"></div>
  </div>

  <!-- COLUMN 3: RUNTIME -->
  <div class="card runtime-box">
    <div class="card-header">
      <h2>3. @agentpact/runtime</h2>
      <span class="badge badge-emerald">&lt; 0.02ms In-Memory</span>
    </div>

    <div style="background: #1e293b; padding: 10px; border-radius: 8px; margin-bottom: 10px;">
      <div style="font-size: 11px; font-weight: 600; color: #cbd5e1; margin-bottom: 4px;">Intercepts Agent Tool Calls</div>
      <div style="font-size: 10px; font-family: ui-monospace, Menlo, monospace; color: #38bdf8;">checkAndReserve(ledger, contract, callContext)</div>
    </div>

    <div style="font-size: 11px; color: #94a3b8; line-height: 1.5; margin-bottom: 10px;">
      <div style="color: #e2e8f0; font-weight: 600; margin-bottom: 4px;">Stateful Ledger Verifications:</div>
      <div>🔒 <strong>Ownership:</strong> principalId owns orderId</div>
      <div>⏳ <strong>Preconditions:</strong> status = DELIVERED, days ≤ 14</div>
      <div>🚫 <strong>Anti-Stacking:</strong> no prior credit on orderId</div>
      <div>💰 <strong>Rolling Budget:</strong> cumulative &lt; $100 / 24h</div>
    </div>

    <div class="verdict-box">
      <div class="verdict-tag verdict-allow">
        <div>ALLOW</div>
        <div style="font-size: 9px; font-weight: 400; opacity: 0.8;">Executes API (0.01ms)</div>
      </div>
      <div class="verdict-tag verdict-block">
        <div>BLOCK</div>
        <div style="font-size: 9px; font-weight: 400; opacity: 0.8;">Halted (Zero Drift)</div>
      </div>
    </div>
  </div>

</div>

<div class="footer-meta">
  <span>⚡ <strong>0 LLM Calls</strong> at runtime</span>
  <span>⏱️ <strong>0.013ms Latency</strong> (vs 800ms for LLM judges)</span>
  <span>🛡️ <strong>Zero Hallucinations</strong> (Mathematically deterministic AST)</span>
</div>

</body>
</html>
  `;

  await page.setContent(htmlContent);

  const outputPath = path.resolve('/Users/vaibhav/agentpact/agentpact_architecture.png');
  const brainPath = path.resolve('/Users/vaibhav/.gemini/antigravity/brain/69e4e79c-be09-466d-bd39-cb6a3fdab278/agentpact_architecture.png');
  
  await page.screenshot({ path: outputPath, fullPage: true });
  fs.copyFileSync(outputPath, brainPath);

  console.log(`Saved architecture diagram to: ${outputPath}`);
  console.log(`Saved architecture diagram to: ${brainPath}`);
  await browser.close();
}

main().catch(console.error);
