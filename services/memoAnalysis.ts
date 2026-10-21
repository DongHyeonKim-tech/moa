import { ANALYSIS_IDLE_MS } from '@/services/aiLimits';
import { shouldAnalyze } from '@/services/analysisPolicy';
import { analyzeMemo } from '@/services/aiClient';
import { refreshRelated } from '@/services/relatedNoteService';
import { useMemoStore } from '@/store/memoStore';
import { useSettingsStore } from '@/store/settingsStore';
import { contentFingerprint, plainTextLength } from '@/utils/fingerprint';

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inflight = new Map<string, string>();

export function scheduleMemoAnalysis(memoId: string, options?: { immediate?: boolean }): void {
  const existing = timers.get(memoId);
  if (existing) {
    clearTimeout(existing);
  }
  const timer = setTimeout(() => {
    timers.delete(memoId);
    void runMemoAnalysis(memoId);
  }, options?.immediate ? 0 : ANALYSIS_IDLE_MS);
  timers.set(memoId, timer);
}

export function flushMemoAnalysis(memoId: string): void {
  if (!timers.has(memoId)) {
    return;
  }
  scheduleMemoAnalysis(memoId, { immediate: true });
}

export function cancelAllAnalyses(): void {
  for (const timer of timers.values()) {
    clearTimeout(timer);
  }
  timers.clear();
}

export function scheduleRecentAnalyses(): void {
  const memos = useMemoStore
    .getState()
    .memos.filter((memo) => !memo.isDeleted)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 5);

  memos.forEach((memo, index) => {
    setTimeout(() => scheduleMemoAnalysis(memo.id, { immediate: true }), index * 500);
  });
}

async function runMemoAnalysis(memoId: string): Promise<void> {
  const memo = useMemoStore.getState().memos.find((item) => item.id === memoId);
  if (!memo || memo.isDeleted) {
    return;
  }

  const fingerprint = contentFingerprint(memo.title, memo.contentMarkdown);
  const decision = shouldAnalyze({
    consent: useSettingsStore.getState().aiConsent,
    plainLength: plainTextLength(memo.title, memo.contentMarkdown),
    fingerprint,
    analyzedContentHash: memo.analyzedContentHash,
    inflightFingerprint: inflight.get(memoId) ?? null,
  });

  if (decision === 'skip-short') {
    await useMemoStore.getState().markAnalysisSkipped(memoId, fingerprint);
    return;
  }
  if (decision !== 'run') {
    return;
  }

  inflight.set(memoId, fingerprint);
  await useMemoStore.getState().setAnalysisStatus(memoId, 'pending');
  try {
    const analysis = await analyzeMemo(memo.title, memo.contentMarkdown);
    if (!useSettingsStore.getState().aiConsent) {
      await useMemoStore.getState().setAnalysisStatus(memoId, 'idle');
      return;
    }
    const applied = await useMemoStore.getState().applyAnalysis(memoId, fingerprint, analysis);
    if (applied) {
      await refreshRelated(memoId, { allowAi: true, force: true });
    }
  } catch {
    const current = useMemoStore.getState().memos.find((item) => item.id === memoId);
    if (current && contentFingerprint(current.title, current.contentMarkdown) === fingerprint) {
      await useMemoStore.getState().setAnalysisStatus(memoId, 'failed');
    }
  } finally {
    if (inflight.get(memoId) === fingerprint) {
      inflight.delete(memoId);
    }
  }
}
