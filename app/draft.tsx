import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MarkdownPreview } from '@/components/memo/MarkdownPreview';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { useAiConsent } from '@/hooks/useAiConsent';
import { aiErrorMessage, draftMemo } from '@/services/aiClient';
import { titleFromMarkdown } from '@/services/markdown';
import { scheduleMemoAnalysis } from '@/services/memoAnalysis';
import { useMemoStore } from '@/store/memoStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import type { DraftedMemo } from '@/types/ai';
import { createId } from '@/utils/id';

const starters = [
  { label: '단어로', text: '주말 장보기, 계란, 우유, 채소' },
  { label: '요청으로', text: '팀 회의 안건을 체크리스트로 써 줘' },
];

export default function DraftScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { ensureConsent } = useAiConsent();
  const params = useLocalSearchParams<{ memoId?: string }>();
  const memoId = Array.isArray(params.memoId) ? params.memoId[0] : params.memoId;
  const memo = useMemoStore((state) => state.memos.find((item) => item.id === memoId) ?? null);
  const saveDraft = useMemoStore((state) => state.saveDraft);
  const queueAiInsertion = useMemoStore((state) => state.queueAiInsertion);
  const [prompt, setPrompt] = useState('');
  const [useContext, setUseContext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DraftedMemo | null>(null);

  const reference = memo && !memo.isDeleted ? `${memo.title}\n\n${memo.contentMarkdown}`.trim() : '';
  const canInsert = Boolean(memoId) && !memo?.isDeleted;

  const write = async () => {
    const agreed = await ensureConsent();
    if (!agreed) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const context = useContext && reference ? reference : undefined;
      setResult(await draftMemo(prompt, context));
    } catch (cause) {
      setError(aiErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  };

  const saveNew = async () => {
    if (!result) {
      return;
    }
    setSaving(true);
    setError(null);
    const id = createId();
    const title = result.title || titleFromMarkdown(result.markdown);
    const saved = await saveDraft(id, { title, contentMarkdown: result.markdown, userTags: [] });
    if (saved !== 'saved') {
      setSaving(false);
      setError('메모를 저장하지 못했어요.');
      return;
    }
    scheduleMemoAnalysis(id);
    router.replace({ pathname: '/memo/[id]', params: { id } });
  };

  const insertHere = () => {
    if (!result || !memoId) {
      return;
    }
    queueAiInsertion({
      memoId,
      title: result.title || titleFromMarkdown(result.markdown),
      markdown: result.markdown,
    });
    router.back();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="AI로 작성" left={<IconButton icon="back" label="뒤로" onPress={() => router.back()} />} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.lead, { color: colors.textSecondary }]}>
            단어만 적어도 관련 메모로 풀어 주고, 어떻게 써 달라고 적어도 그 요청대로 작성해요.
          </Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder={'주말 장보기, 계란, 우유\n회의 안건을 체크리스트로 써 줘'}
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            multiline
            textAlignVertical="top"
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          />
          <View style={styles.chips}>
            {starters.map((item) => (
              <Chip key={item.label} label={item.label} onPress={() => setPrompt(item.text)} />
            ))}
            {reference ? (
              <Chip label="이 메모를 참고" selected={useContext} onPress={() => setUseContext((current) => !current)} />
            ) : null}
          </View>
          {loading ? (
            <View style={styles.status}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[styles.statusText, { color: colors.textSecondary }]}>메모를 작성하고 있어요</Text>
            </View>
          ) : null}
          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          {result && !loading ? (
            <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.previewTitle, { color: colors.text }]}>{result.title || '제목 없음'}</Text>
              <MarkdownPreview markdown={result.markdown} attachments={[]} />
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          {result && !loading ? (
            <>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => {
                  void saveNew();
                }}
                style={[styles.primary, { backgroundColor: colors.accent, opacity: saving ? 0.5 : 1 }]}>
                <Text style={[styles.primaryLabel, { color: colors.onAccent }]}>{saving ? '저장 중' : '새 메모로 저장'}</Text>
              </Pressable>
              {canInsert ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={insertHere}
                  style={[styles.secondary, { borderColor: colors.border }]}>
                  <Text style={[styles.secondaryLabel, { color: colors.accentText }]}>이 메모에 넣기</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={loading || saving || prompt.trim().length === 0}
                onPress={() => {
                  void write();
                }}
                style={styles.textButton}>
                <Text style={[styles.secondaryLabel, { color: colors.textSecondary }]}>다시 작성</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={loading || prompt.trim().length === 0}
              onPress={() => {
                void write();
              }}
              style={[styles.primary, { backgroundColor: colors.accent, opacity: loading || prompt.trim().length === 0 ? 0.4 : 1 }]}>
              <Text style={[styles.primaryLabel, { color: colors.onAccent }]}>작성하기</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  lead: {
    ...typography.preview,
  },
  input: {
    minHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    lineHeight: 24,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  status: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  statusText: {
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
  },
  preview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  previewTitle: {
    ...typography.cardTitle,
  },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  primary: {
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  secondary: {
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  textButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
