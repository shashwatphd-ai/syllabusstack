/**
 * Signal Services — Barrel Export
 */
export { JobSkillsSignal } from './job-skills-signal.ts';
export { MarketIntelSignal } from './market-intel-signal.ts';
export { DepartmentFitSignal } from './department-fit-signal.ts';
export { ContactQualitySignal } from './contact-quality-signal.ts';

export {
  calculateCompanySignals,
  calculateBatchSignals,
  toStorableSignalData,
  SIGNAL_PROVIDERS,
} from './signal-orchestrator.ts';

export type {
  SignalResult,
  SignalProvider,
  SignalContext,
  SignalName,
  CompositeScore,
  SignalScores,
  CompanyForSignal,
  StorableSignalData,
} from '../signal-types.ts';

export { SIGNAL_WEIGHTS } from '../signal-types.ts';
