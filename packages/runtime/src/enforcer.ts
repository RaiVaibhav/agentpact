import type { AgentPactContract, VerdictType } from '@agentpact/contract';
export type { VerdictType };
import { StatefulLedger } from './ledger';

export interface CallContext {
  callId: string;
  sessionId: string;
  principalId: string;
  toolName: string;
  args: Record<string, any>;
  timestampMs?: number;
}

export interface EnforceResult {
  verdict: VerdictType;
  ruleId?: string;
  reason?: string;
  latencyMs: number;
}

export function checkAndReserve(
  ledger: StatefulLedger,
  contract: AgentPactContract,
  callContext: CallContext
): EnforceResult {
  const start = performance.now();
  const nowMs = callContext.timestampMs ?? Date.now();
  const { sessionId, principalId, toolName, args, callId } = callContext;

  const toolContract = contract.tools[toolName];
  if (!toolContract) {
    return {
      verdict: 'ALLOW',
      latencyMs: Number((performance.now() - start).toFixed(3)),
    };
  }

  // 1. Ownership Binding
  if (toolContract.ownership) {
    const { lookupTool, matchArg, ownerField } = toolContract.ownership;
    const matchVal = args[matchArg];
    const priorOutput = ledger.findPriorOutput(sessionId, lookupTool, matchArg, matchVal);

    if (!priorOutput) {
      return {
        verdict: (toolContract.ownership as any).onViolation || 'BLOCK',
        reason: `Missing prior lookup call to ${lookupTool} for ${matchArg}='${matchVal}'`,
        latencyMs: Number((performance.now() - start).toFixed(3)),
      };
    }

    if (priorOutput[ownerField] !== principalId) {
      return {
        verdict: (toolContract.ownership as any).onViolation || 'BLOCK',
        reason: `Ownership mismatch: principalId '${principalId}' does not own entity (${ownerField} was '${priorOutput[ownerField]}')`,
        latencyMs: Number((performance.now() - start).toFixed(3)),
      };
    }
  }

  // 2. Preconditions
  for (const rule of toolContract.preconditions || []) {
    // Check conditional whenArg
    if (rule.whenArg) {
      const currentVal = args[rule.whenArg.field];
      if (rule.whenArg.op === 'eq' && currentVal !== rule.whenArg.value) {
        continue; // condition does not apply
      }
    }

    const matchKey = rule.matchArg || 'orderId';
    const matchVal = args[matchKey];
    const lookupToolName = rule.lookupTool || rule.requirePriorTool;

    if (!lookupToolName) continue;

    const priorOutput = ledger.findPriorOutput(sessionId, lookupToolName, matchKey, matchVal);

    if (!priorOutput) {
      return {
        verdict: rule.onViolation,
        ruleId: (rule as any).id,
        reason: `Missing prior lookup output for ${lookupToolName}`,
        latencyMs: Number((performance.now() - start).toFixed(3)),
      };
    }

    // Evaluate op
    if (rule.op === 'lte_field') {
      const argVal = Number(args[rule.argField!]);
      const targetVal = Number(priorOutput[rule.targetField!]);
      if (isNaN(argVal) || isNaN(targetVal) || argVal > targetVal) {
        return {
          verdict: rule.onViolation,
          ruleId: (rule as any).id,
          reason: `Precondition failed: ${rule.argField} (${argVal}) exceeds target ${rule.targetField} (${targetVal})`,
          latencyMs: Number((performance.now() - start).toFixed(3)),
        };
      }
    } else if (rule.op === 'eq') {
      const fieldToCheck = rule.field || rule.outputField;
      const actualVal = priorOutput[fieldToCheck!];
      if (actualVal !== rule.value) {
        return {
          verdict: rule.onViolation,
          ruleId: (rule as any).id,
          reason: `Precondition failed: ${fieldToCheck} was '${actualVal}', required eq '${rule.value}'`,
          latencyMs: Number((performance.now() - start).toFixed(3)),
        };
      }
    } else if (rule.op === 'lte') {
      const actualVal = Number(priorOutput[rule.field!]);
      const maxVal = Number(rule.value);
      if (isNaN(actualVal) || actualVal > maxVal) {
        return {
          verdict: rule.onViolation,
          ruleId: (rule as any).id,
          reason: `Precondition failed: ${rule.field} (${actualVal}) exceeds max allowed (${maxVal})`,
          latencyMs: Number((performance.now() - start).toFixed(3)),
        };
      }
    }
  }

  // 3. Mutual Exclusion (Anti-Stacking)
  if (toolContract.mutualExclusion) {
    const { conflictingTools, scopeKey, onViolation } = toolContract.mutualExclusion;
    const scopeVal = args[scopeKey];
    if (ledger.hasConflictingMutation(conflictingTools, scopeKey, scopeVal)) {
      return {
        verdict: onViolation,
        reason: `Anti-stacking violation: conflicting mutation already recorded or reserved for ${scopeKey}='${scopeVal}'`,
        latencyMs: Number((performance.now() - start).toFixed(3)),
      };
    }
  }

  // 4. Budget Tracking (Rolling Window)
  if (toolContract.budget) {
    const { sharedAcrossTools, argField, windowSeconds, maxTotal, onViolation } = toolContract.budget;
    const currentSpend = ledger.getPrincipalSpend(
      principalId,
      sharedAcrossTools || [toolName],
      argField,
      windowSeconds,
      nowMs
    );
    const amount = Number(args[argField]) || 0;

    if (currentSpend + amount > maxTotal) {
      return {
        verdict: onViolation,
        reason: `Budget cap exceeded: total spend across ${windowSeconds}s would be ${currentSpend + amount}, exceeding max budget of ${maxTotal}`,
        latencyMs: Number((performance.now() - start).toFixed(3)),
      };
    }
  }

  // 5. Thresholds (Escalation)
  for (const rule of toolContract.thresholds || []) {
    if (args.managerApproved || args.approvedByManager || args.isEscalated) {
      continue;
    }
    const amount = Number(args[rule.argField]) || 0;
    if (amount > rule.value) {
      return {
        verdict: rule.onViolation,
        ruleId: (rule as any).id,
        reason: `Threshold exceeded: ${rule.argField} (${amount}) exceeds threshold of ${rule.value} (requires escalation)`,
        latencyMs: Number((performance.now() - start).toFixed(3)),
      };
    }
  }

  // 6. Atomic Reservation
  const reservedAmount = toolContract.budget
    ? Number(args[toolContract.budget.argField]) || 0
    : 0;
  const scopeKey = toolContract.mutualExclusion?.scopeKey;

  ledger.createReservation(callId, {
    principalId,
    toolName,
    args: { ...args, sessionId },
    amountReserved: reservedAmount,
    scopeEntityKey: scopeKey ? String(args[scopeKey]) : undefined,
    timestampMs: nowMs,
  });

  return {
    verdict: 'ALLOW',
    latencyMs: Number((performance.now() - start).toFixed(3)),
  };
}

