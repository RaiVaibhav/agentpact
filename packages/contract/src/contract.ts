import {
  OperatorSchema,
  ViolationActionSchema,
  OwnershipRuleSchema,
  WhenArgSchema,
  PreconditionRuleSchema,
  ThresholdRuleSchema,
  MutualExclusionRuleSchema,
  BudgetRuleSchema,
  ToolContractSchema,
  UnmappableRuleSchema,
  AgentPactContractSchema,
  AgentGateContractSchema,
  type Operator,
  type ViolationAction,
  type OwnershipRule,
  type WhenArg,
  type PreconditionRule,
  type ThresholdRule,
  type MutualExclusionRule,
  type BudgetRule,
  type ToolContract,
  type UnmappableRule,
  type AgentPactContract,
  type AgentGateContract,
} from "./schema";

export const VerdictTypeSchema = ViolationActionSchema;
export type VerdictType = ViolationAction;

export const ComparisonOpSchema = OperatorSchema;
export type ComparisonOp = Operator;

export {
  OperatorSchema,
  ViolationActionSchema,
  OwnershipRuleSchema,
  WhenArgSchema,
  PreconditionRuleSchema,
  ThresholdRuleSchema,
  MutualExclusionRuleSchema,
  BudgetRuleSchema,
  ToolContractSchema,
  UnmappableRuleSchema,
  AgentPactContractSchema,
  AgentGateContractSchema,
  type Operator,
  type ViolationAction,
  type OwnershipRule,
  type WhenArg,
  type PreconditionRule,
  type ThresholdRule,
  type MutualExclusionRule,
  type BudgetRule,
  type ToolContract,
  type UnmappableRule,
  type AgentPactContract,
  type AgentGateContract,
};

