export interface RecordedCall {
  callId: string;
  sessionId: string;
  principalId: string;
  toolName: string;
  args: Record<string, any>;
  output: Record<string, any>;
  timestampMs: number;
}

export interface PendingReservation {
  principalId: string;
  toolName: string;
  args: Record<string, any>;
  amountReserved: number;
  scopeEntityKey?: string;
  timestampMs: number;
}

export interface ReservationRequest {
  callId: string;
  principalId: string;
  toolName: string;
  amount: number;
  entityId?: string;
  maxBudget: number;
  windowSeconds: number;
}

export interface CommittedTransaction {
  callId: string;
  principalId: string;
  toolName: string;
  amount: number;
  entityId?: string;
  timestamp: number;
}

export interface Reservation {
  callId: string;
  principalId: string;
  toolName: string;
  amount: number;
  entityId?: string;
  timestamp: number;
}

export class StatefulLedger {
  recordedCalls: RecordedCall[] = [];
  pendingReservations: Map<string, PendingReservation> = new Map();
  private entityToolHistory: Map<string, Set<string>> = new Map();
  private toolOutputs: Map<string, Map<string, any>> = new Map();

  recordReadOutput(
    sessionId: string,
    principalId: string,
    toolName: string,
    args: Record<string, any>,
    output: Record<string, any>,
    timestampMs?: number
  ): void {
    const callId = `read_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.recordedCalls.push({
      callId,
      sessionId,
      principalId,
      toolName,
      args,
      output,
      timestampMs: timestampMs ?? Date.now(),
    });

    const entityId = args['orderId'] || args['subscriptionId'] || args['id'];
    if (entityId) {
      this.recordToolOutput(String(entityId), toolName, output);
    }
  }

  findPriorOutput(
    sessionId: string,
    toolName: string,
    matchArgKey: string,
    matchArgValue: any
  ): Record<string, any> | undefined {
    // 1. Search backward in recorded calls for this session
    for (let i = this.recordedCalls.length - 1; i >= 0; i--) {
      const call = this.recordedCalls[i];
      if (
        call.sessionId === sessionId &&
        call.toolName === toolName &&
        call.args[matchArgKey] === matchArgValue
      ) {
        return call.output;
      }
    }

    // 2. Fallback to entity tool outputs cache
    if (matchArgValue !== undefined && matchArgValue !== null) {
      const fromCache = this.getToolOutput(String(matchArgValue), toolName);
      if (fromCache) return fromCache;
    }

    return undefined;
  }

  hasConflictingMutation(
    conflictingTools: string[],
    scopeKey: string,
    scopeValue: any
  ): boolean {
    if (scopeValue === undefined || scopeValue === null) {
      return false;
    }

    // 1. Check committed calls across ALL sessions
    for (const call of this.recordedCalls) {
      if (
        conflictingTools.includes(call.toolName) &&
        call.args[scopeKey] === scopeValue
      ) {
        return true;
      }
    }

    // 2. Check pending reservations across ALL sessions
    for (const res of this.pendingReservations.values()) {
      if (
        conflictingTools.includes(res.toolName) &&
        res.args[scopeKey] === scopeValue
      ) {
        return true;
      }
    }

    // 3. Check entity tool history
    const conflict = this.hasConflictingTool(String(scopeValue), conflictingTools);
    if (conflict.hasConflict) return true;

    return false;
  }

  getPrincipalSpend(
    principalId: string,
    sharedTools: string[],
    argField: string,
    windowSeconds: number,
    nowMs: number
  ): number {
    const windowStartMs = nowMs - windowSeconds * 1000;
    let total = 0;

    // 1. Sum committed calls for principal within rolling window
    for (const call of this.recordedCalls) {
      if (
        call.principalId === principalId &&
        sharedTools.includes(call.toolName) &&
        call.timestampMs >= windowStartMs
      ) {
        const val = Number(call.args[argField]) || 0;
        total += val;
      }
    }

    // 2. Sum active pending reservations
    for (const res of this.pendingReservations.values()) {
      if (
        res.principalId === principalId &&
        sharedTools.includes(res.toolName) &&
        res.timestampMs >= windowStartMs
      ) {
        total += res.amountReserved;
      }
    }

    return total;
  }

  createReservation(
    callId: string,
    reservationData: PendingReservation
  ): void {
    this.pendingReservations.set(callId, reservationData);
  }

  commitReservation(callId: string, output: Record<string, any> = {}): void {
    const pending = this.pendingReservations.get(callId);
    if (!pending) return;

    this.pendingReservations.delete(callId);
    this.recordedCalls.push({
      callId,
      sessionId: pending.args.sessionId ?? 'default',
      principalId: pending.principalId,
      toolName: pending.toolName,
      args: pending.args,
      output,
      timestampMs: pending.timestampMs,
    });

    if (pending.scopeEntityKey) {
      this.recordEntityTool(pending.scopeEntityKey, pending.toolName);
    }
  }

  rollbackReservation(callId: string): void {
    this.pendingReservations.delete(callId);
  }

  /**
   * Two-phase atomic reservation for PolicyEvaluator
   */
  checkAndReserve(req: ReservationRequest): { reserved: boolean; currentTotal: number; maxBudget: number } {
    const now = Date.now();
    const currentSpend = this.getPrincipalSpend(req.principalId, [req.toolName], 'amount_cents', req.windowSeconds, now);

    if (currentSpend + req.amount > req.maxBudget) {
      return {
        reserved: false,
        currentTotal: currentSpend,
        maxBudget: req.maxBudget,
      };
    }

    this.createReservation(req.callId, {
      principalId: req.principalId,
      toolName: req.toolName,
      args: { amount_cents: req.amount, entityId: req.entityId },
      amountReserved: req.amount,
      scopeEntityKey: req.entityId,
      timestampMs: now,
    });

    return {
      reserved: true,
      currentTotal: currentSpend + req.amount,
      maxBudget: req.maxBudget,
    };
  }

  // Support for @agentgate/runtime wrapper methods
  commit(callId: string): void {
    this.commitReservation(callId, {});
  }

  rollback(callId: string): void {
    this.rollbackReservation(callId);
  }

  recordEntityTool(entityId: string, toolName: string): void {
    if (!this.entityToolHistory.has(entityId)) {
      this.entityToolHistory.set(entityId, new Set());
    }
    this.entityToolHistory.get(entityId)!.add(toolName);
  }

  hasConflictingTool(entityId: string, conflictingTools: string[]): { hasConflict: boolean; conflictingTool?: string } {
    const history = this.entityToolHistory.get(entityId);
    if (!history) return { hasConflict: false };

    for (const tool of conflictingTools) {
      if (history.has(tool)) {
        return { hasConflict: true, conflictingTool: tool };
      }
    }

    return { hasConflict: false };
  }

  recordToolOutput(entityId: string, toolName: string, output: any): void {
    if (!this.toolOutputs.has(entityId)) {
      this.toolOutputs.set(entityId, new Map());
    }
    this.toolOutputs.get(entityId)!.set(toolName, output);
  }

  getToolOutput(entityId: string, toolName: string): any {
    return this.toolOutputs.get(entityId)?.get(toolName);
  }

  reset(): void {
    this.recordedCalls = [];
    this.pendingReservations.clear();
    this.entityToolHistory.clear();
    this.toolOutputs.clear();
  }
}
