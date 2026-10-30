import fs from 'fs';
import path from 'path';
import { StatefulLedger, checkAndReserve } from '@agentpact/runtime';
import type { AgentPactContract } from '@agentpact/contract';

// 1. Load compiled AgentPact contract
const contractPath = path.resolve(__dirname, 'agentpact.contract.json');
const contract: AgentPactContract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

// 2. Initialize in-memory stateful ledger (<0.02ms latency)
const ledger = new StatefulLedger();
const sessionId = 'session_cust_987';
const principalId = 'user_123';
const orderId = 'ord_456';

console.log('🛡️  AgentPact Local Runtime Demo\n');

// Turn 0: Agent looks up order
ledger.recordReadOutput(sessionId, principalId, 'get_order', { orderId }, {
  orderId,
  userId: principalId,
  status: 'DELIVERED',
  daysSinceDelivery: 4,
  totalPaid_cents: 6000,
});
console.log(`[Turn 0]: Lookup 'get_order' recorded for ${orderId}`);

// Turn 1: Agent calls issue_refund($30 -> 3000 cents)
const turn1Result = checkAndReserve(ledger, contract, {
  callId: 'call_turn1_refund',
  sessionId,
  principalId,
  toolName: 'issue_refund',
  args: { orderId, amount_cents: 3000, reason: 'LATE' },
});
console.log(`[Turn 1]: issue_refund($30) -> Verdict: ${turn1Result.verdict} (${turn1Result.latencyMs} ms)`);
if (turn1Result.verdict === 'ALLOW') {
  ledger.commit('call_turn1_refund');
}

// Turn 2: User sweet-talks agent into adding $30 store credit
const turn2Result = checkAndReserve(ledger, contract, {
  callId: 'call_turn2_credit',
  sessionId,
  principalId,
  toolName: 'add_wallet_credit',
  args: { orderId, amount_cents: 3000 },
});
console.log(`[Turn 2]: add_wallet_credit($30) -> Verdict: ${turn2Result.verdict} (${turn2Result.latencyMs} ms)`);
if (turn2Result.reason) {
  console.log(`         Reason: ${turn2Result.reason}`);
}

if (turn2Result.verdict === 'BLOCK') {
  console.log('\n✅ AgentPact successfully stopped multi-turn action stacking in <0.02ms!');
}
