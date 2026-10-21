import { MIN_ANALYSIS_LENGTH } from '@/services/aiLimits';

export type AnalysisDecision = 'run' | 'skip-consent' | 'skip-short' | 'skip-same' | 'skip-inflight';

export function shouldAnalyze(input: {
  consent: boolean;
  plainLength: number;
  fingerprint: string;
  analyzedContentHash: string | null;
  inflightFingerprint: string | null;
}): AnalysisDecision {
  if (!input.consent) {
    return 'skip-consent';
  }
  if (input.inflightFingerprint === input.fingerprint) {
    return 'skip-inflight';
  }
  if (input.plainLength < MIN_ANALYSIS_LENGTH) {
    return 'skip-short';
  }
  if (input.analyzedContentHash === input.fingerprint) {
    return 'skip-same';
  }
  return 'run';
}
