import { describe, it, expect } from 'vitest';
import { StatefulLedger, checkAndReserve } from '../src';
import type { AgentPactContract } from '@agentpact/contract';

describe('AgentPact Runtime Enforcer', () => {
  const sampleContract: AgentPactContract = {
    version: '2.0',
    tools: {
      issue_refund: {
        ownership: {
          lookupTool: 'get_order',
          matchArg: 'orderId',
          ownerField: 'userId',
          equalsContext: 'principalId',
          onViolation: 'BLOCK',
        },
        preconditions: [
          {
            source: 'routes/refunds.ts:L10',
            lookupTool: 'get_order',
            field: 'status',
            op: 'eq',
            value: 'DELIVERED',
            onViolation: 'BLOCK',
          },
        ],
        mutualExclusion: {
          source: 'prompt.md:L5',
          conflictingTools: ['add_wallet_credit'],
          scopeKey: 'orderId',
          onViolation: 'BLOCK',
        },
        budget: {
          source: 'prompt.md:L6',
          argField: 'amount_cents',
          sharedAcrossTools: ['issue_refund', 'add_wallet_credit'],
          scope: 'principalId',
          windowSeconds: 86400,
          maxTotal: 5000,
          onViolation: 'BLOCK',
        },
      },
      add_wallet_credit: {
        preconditions: [],
        thresholds: [],
        mutualExclusion: {
          source: 'prompt.md:L5',
          conflictingTools: ['issue_refund'],
          scopeKey: 'orderId',
          onViolation: 'BLOCK',
        },
      },
    },
    unmappableRules: [],
  };

  it('allows valid initial refund within limits in sub-millisecond time', () => {
    const ledger = new StatefulLedger();
    ledger.recordReadOutput('session_1', 'user_abc', 'get_order', { orderId: 'ord_1' }, {
      orderId: 'ord_1',
      userId: 'user_abc',
      status: 'DELIVERED',
    });

    const res = checkAndReserve(ledger, sampleContract, {
      callId: 'call_1',
      sessionId: 'session_1',
      principalId: 'user_abc',
      toolName: 'issue_refund',
      args: { orderId: 'ord_1', amount_cents: 2500 },
    });

    expect(res.verdict).toBe('ALLOW');
    expect(res.latencyMs).toBeLessThan(1.0);
  });

  it('blocks multi-turn action stacking (refund + credit on same order)', () => {
    const ledger = new StatefulLedger();
    ledger.recordReadOutput('session_1', 'user_abc', 'get_order', { orderId: 'ord_1' }, {
      orderId: 'ord_1',
      userId: 'user_abc',
      status: 'DELIVERED',
    });

    // Turn 1
    const t1 = checkAndReserve(ledger, sampleContract, {
      callId: 'call_1',
      sessionId: 'session_1',
      principalId: 'user_abc',
      toolName: 'issue_refund',
      args: { orderId: 'ord_1', amount_cents: 2000 },
    });
    expect(t1.verdict).toBe('ALLOW');
    ledger.commit('call_1');

    // Turn 2
    const t2 = checkAndReserve(ledger, sampleContract, {
      callId: 'call_2',
      sessionId: 'session_1',
      principalId: 'user_abc',
      toolName: 'add_wallet_credit',
      args: { orderId: 'ord_1', amount_cents: 1500 },
    });

    expect(t2.verdict).toBe('BLOCK');
    expect(t2.reason).toContain('Anti-stacking violation');
  });

  it('blocks IDOR ownership spoofing', () => {
    const ledger = new StatefulLedger();
    // Order belongs to user_OTHER
    ledger.recordReadOutput('session_1', 'attacker', 'get_order', { orderId: 'ord_99' }, {
      orderId: 'ord_99',
      userId: 'user_victim',
      status: 'DELIVERED',
    });

    const res = checkAndReserve(ledger, sampleContract, {
      callId: 'call_idor',
      sessionId: 'session_1',
      principalId: 'attacker',
      toolName: 'issue_refund',
      args: { orderId: 'ord_99', amount_cents: 1000 },
    });

    expect(res.verdict).toBe('BLOCK');
    expect(res.reason).toContain('Ownership mismatch');
  });
});

