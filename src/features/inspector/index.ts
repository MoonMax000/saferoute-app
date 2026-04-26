export { InspectorToggle } from "./InspectorToggle";
export { useInspectorStore } from "./inspector-store";
export {
  useRiskConfigStore,
  DEFAULT_ELEVATED_THRESHOLD,
  DEFAULT_BLOCKING_WEIGHT,
  DEFAULT_ADVISORY_WEIGHT,
} from "./risk-config-store";
export { useEffectiveRiskCells } from "./use-effective-risk-cells";
export {
  inspectorLog,
  clearInspectorLog,
  getInspectorLog,
  subscribeInspectorLog,
  fmtNum,
} from "./inspector-log";
export type {
  PaintZone,
  InspectorLogEntry,
  InspectorLogLevel,
  FormulaBreakdown,
  FormulaBreakdownCell,
  VerificationPhase,
  VerificationSummary,
} from "./inspector.types";
