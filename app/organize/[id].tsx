import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MarkdownPreview } from '@/components/memo/MarkdownPreview';
import { organizeModes } from '@/components/memo/OrganizeModeSheet';
import { IconButton } from '@/components/ui/IconButton';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { aiErrorMessage, organizeMemo } from '@/services/aiClient';
import { userFacingError } from '@/services/dataError';
import { titleFromMarkdown } from '@/services/markdown';
import { scheduleMemoAnalysis } from '@/services/memoAnalysis';
import { useMemoStore } from '@/store/memoStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { OrganizeMode } from '@/types/ai';

function isMode(value: string | undefined): value is OrganizeMode {
  return value === 'tidy' || value === 'checklist' || value === 'prose' || value === 'summary';
}

export default function OrganizeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string; mode?: string }>();
  const memoId = Array.isArray(params.id) ? params.id[0] : params.id;
  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const mode: OrganizeMode = isMode(modeParam) ? modeParam : 'tidy';
  const memo = useMemoStore((state) => state.memos.find((item) => item.id === memoId) ?? null);
  const attachmentList = useMemoStore((state) => state.attachments);
  const attachments = useMemo(
    () => attachmentList.filter((item) => item.memoId === memoId),
    [attachmentList, memoId],
  );
  const saveAiDraft = useMemoStore((state) => state.saveAiDraft);
  const applyAiDraft = useMemoStore((state) => state.applyAiDraft);
  const [view, setView] = useState<'result' | 'original'>('result');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const startedRef = useRef(false);

  const request = (content: string) => {
    setLoading(true);
    setError(null);
    void organizeMemo(content, mode)
      .then((markdown) => {
        setResult(markdown);
        if (memoId) {
          void saveAiDraft(memoId, markdown).catch(() => undefined);
        }
      })
      .catch((cause: unknown) => setError(aiErrorMessage(cause)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    const current = useMemoStore.getState().memos.find((item) => item.id === memoId);
    if (!current) {
      setLoading(false);
      setError('메모를 찾지 못했어요.');
      return;
    }
    startedRef.current = true;
    request(`${current.title}\n\n${current.contentMarkdown}`);
    // 화면을 연 순간의 원본만 정리한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoId]);

  const retry = () => {
    const current = memo ?? useMemoStore.getState().memos.find((item) => item.id === memoId);
    if (!current) {
      return;
    }
    request(`${current.title}\n\n${current.contentMarkdown}`);
  };

  const apply = async () => {
    if (!memo || !result) {
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const title = memo.title.trim() ? memo.title : titleFromMarkdown(result);
      await applyAiDraft(memo.id, result, title);
      scheduleMemoAnalysis(memo.id);
      router.back();
    } catch (cause) {
      setError(userFacingError(cause));
      setApplying(false);
    }
  };

  const modeLabel = organizeModes.find((item) => item.id === mode)?.label ?? '생각 정리하기';

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        title={modeLabel}
        left={<IconButton icon="back" label="뒤로" onPress={() => router.back()} />}
      />
      <View style={styles.switcher}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setView('original')}
          style={[styles.switchItem, { backgroundColor: view === 'original' ? colors.surface : 'transparent' }]}>
          <Text style={{ color: view === 'original' ? colors.text : colors.textSecondary, fontWeight: '600' }}>원본</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setView('result')}
          style={[styles.switchItem, { backgroundColor: view === 'result' ? colors.surface : 'transparent' }]}>
          <Text style={{ color: view === 'result' ? colors.text : colors.textSecondary, fontWeight: '600' }}>정리 결과</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>생각을 정리하고 있어요</Text>
          </View>
        ) : null}
        {!loading && error ? (
          <View style={styles.status}>
            <Text style={[styles.statusText, { color: colors.text }]}>{error}</Text>
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>원본 메모는 그대로예요.</Text>
            <Pressable accessibilityRole="button" onPress={retry} style={[styles.secondary, { borderColor: colors.border }]}>
              <Text style={{ color: colors.accentText, fontWeight: '600' }}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}
        {!loading && !error && memo && view === 'original' ? (
          <MarkdownPreview markdown={memo.contentMarkdown} attachments={attachments} />
        ) : null}
        {!loading && !error && result && view === 'result' ? (
          <MarkdownPreview markdown={result} attachments={attachments} />
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.footerButton}>
          <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>취소</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!result || loading || applying}
          onPress={() => {
            void apply();
          }}
          style={[styles.footerButton, styles.apply, { backgroundColor: colors.accent, opacity: !result || loading ? 0.4 : 1 }]}>
          <Text style={[styles.footerLabel, { color: colors.onAccent }]}>{applying ? '적용 중' : '적용하기'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  switcher: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  switchItem: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  status: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxxl,
  },
  statusText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  footerButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apply: {},
  footerLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
});
