import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MarkdownPreview } from '@/components/memo/MarkdownPreview';
import { IconButton } from '@/components/ui/IconButton';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { useAiConsent } from '@/hooks/useAiConsent';
import { aiErrorMessage, mergeMemos } from '@/services/aiClient';
import { userFacingError } from '@/services/dataError';
import { buildMergePayload } from '@/services/aiPayload';
import { titleFromMarkdown } from '@/services/markdown';
import { scheduleMemoAnalysis } from '@/services/memoAnalysis';
import { useMemoStore } from '@/store/memoStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { displayTitle } from '@/utils/memoText';

export default function MergeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { ensureConsent } = useAiConsent();
  const params = useLocalSearchParams<{ ids?: string }>();
  const rawIds = Array.isArray(params.ids) ? params.ids[0] : params.ids;
  const ids = useMemo(() => {
    const raw = typeof rawIds === 'string' ? rawIds : '';
    return raw.split(',').filter((id) => id.length > 0);
  }, [rawIds]);
  const memos = useMemoStore((state) => state.memos);
  const createMergedMemo = useMemoStore((state) => state.createMergedMemo);
  const selected = ids.flatMap((id) => {
    const memo = memos.find((item) => item.id === id && !item.isDeleted);
    return memo ? [memo] : [];
  });
  const payload = buildMergePayload(selected);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const notice = error ?? (payload.ok ? null : payload.message);

  const run = async () => {
    const agreed = await ensureConsent();
    if (!agreed) {
      return;
    }
    const nextPayload = buildMergePayload(selected);
    if (!nextPayload.ok) {
      setError(nextPayload.message);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResult(await mergeMemos(selected));
    } catch (cause) {
      setError(aiErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!result) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await createMergedMemo({
        title: titleFromMarkdown(result),
        contentMarkdown: result,
        sourceIds: selected.map((memo) => memo.id),
      });
      scheduleMemoAnalysis(id);
      router.replace({ pathname: '/memo/[id]', params: { id } });
    } catch (cause) {
      setError(userFacingError(cause));
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="함께 모아보기" left={<IconButton icon="back" label="뒤로" onPress={() => router.back()} />} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.lead, { color: colors.textSecondary }]}>
          선택한 메모의 내용을 하나의 기록으로 정리해요. 원래 메모는 바꾸지 않아요.
        </Text>
        {selected.map((memo) => (
          <View key={memo.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{displayTitle(memo)}</Text>
          </View>
        ))}
        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.accent} />
            <Text style={{ color: colors.textSecondary }}>기록을 모으고 있어요</Text>
          </View>
        ) : null}
        {notice ? <Text style={[styles.error, { color: colors.danger }]}>{notice}</Text> : null}
        {result ? (
          <View style={styles.preview}>
            <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>모아본 결과</Text>
            <MarkdownPreview markdown={result} attachments={[]} />
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        {result ? (
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => {
              void save();
            }}
            style={[styles.button, { backgroundColor: colors.accent, opacity: saving ? 0.6 : 1 }]}>
            <Text style={[styles.buttonLabel, { color: colors.onAccent }]}>{saving ? '저장 중' : '새 메모로 저장'}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={loading || !payload.ok}
            onPress={() => {
              void run();
            }}
            style={[styles.button, { backgroundColor: colors.accent, opacity: loading || !payload.ok ? 0.45 : 1 }]}>
            <Text style={[styles.buttonLabel, { color: colors.onAccent }]}>AI로 모아보기</Text>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  status: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  error: {
    fontSize: 15,
    lineHeight: 22,
  },
  preview: {
    gap: spacing.sm,
  },
  previewLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
});
