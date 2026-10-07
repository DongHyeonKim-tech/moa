import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TagEditor } from '@/components/memo/TagEditor';
import { IconButton } from '@/components/ui/IconButton';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { draftFromMemo, isBlankDraft } from '@/services/memoRules';
import { useMemoStore } from '@/store/memoStore';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';
import type { MemoDraft } from '@/types/memo';
import { formatFullDate, formatRelativeTime } from '@/utils/date';

const AUTOSAVE_MS = 400;

export default function MemoEditorScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const memoId = Array.isArray(params.id) ? params.id[0] : params.id;
  const memo = useMemoStore((state) => state.memos.find((item) => item.id === memoId) ?? null);
  const saveDraft = useMemoStore((state) => state.saveDraft);
  const toggleFavorite = useMemoStore((state) => state.toggleFavorite);
  const togglePin = useMemoStore((state) => state.togglePin);
  const moveToTrash = useMemoStore((state) => state.moveToTrash);
  const restore = useMemoStore((state) => state.restore);

  const [draft, setDraft] = useState<MemoDraft>(() =>
    draftFromMemo(useMemoStore.getState().memos.find((item) => item.id === memoId)),
  );
  const [sessionId, setSessionId] = useState(memoId);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const draftRef = useRef(draft);
  const dirtyRef = useRef(false);
  const mountedRef = useRef(true);
  const contentRef = useRef<TextInput>(null);

  if (memoId && sessionId !== memoId) {
    setSessionId(memoId);
    setDraft(draftFromMemo(useMemoStore.getState().memos.find((item) => item.id === memoId)));
    setSaveState('idle');
    dirtyRef.current = false;
  }

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!memoId) {
      return;
    }
    const existing = useMemoStore.getState().memos.find((item) => item.id === memoId && !item.isDeleted);
    if (!existing) {
      return;
    }
    void useMemoStore.getState().markViewed(memoId);
  }, [memoId]);

  useEffect(() => {
    if (!dirtyRef.current || !memoId) {
      return undefined;
    }

    const timer = setTimeout(() => {
      void saveDraft(memoId, draftRef.current).then((result) => {
        if (!mountedRef.current) {
          return;
        }
        setSaveState(result === 'skipped' ? 'idle' : 'saved');
      });
    }, AUTOSAVE_MS);

    return () => clearTimeout(timer);
  }, [draft, memoId, saveDraft]);

  useEffect(() => {
    if (!memoId) {
      return undefined;
    }

    return () => {
      if (!dirtyRef.current) {
        return;
      }
      void saveDraft(memoId, draftRef.current);
    };
  }, [memoId, saveDraft]);

  const updateDraft = (patch: Partial<MemoDraft>) => {
    dirtyRef.current = true;
    setSaveState('saving');
    setDraft((current) => {
      const next = { ...current, ...patch };
      draftRef.current = next;
      return next;
    });
  };

  const withSavedMemo = async (action: () => Promise<void>) => {
    if (!memoId) {
      return;
    }
    const result = await saveDraft(memoId, draftRef.current);
    if (result === 'skipped') {
      return;
    }
    await action();
  };

  const onDelete = () => {
    if (!memoId) {
      return;
    }

    if (!memo && isBlankDraft(draftRef.current)) {
      dirtyRef.current = false;
      router.back();
      return;
    }

    Alert.alert('메모를 휴지통으로 옮길까요?', '휴지통에서 다시 복원할 수 있어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          dirtyRef.current = false;
          void (async () => {
            await saveDraft(memoId, draftRef.current);
            await moveToTrash(memoId);
            router.back();
          })();
        },
      },
    ]);
  };

  if (!memoId) {
    return null;
  }

  const headerTitle = saveState === 'saving' ? '저장 중' : saveState === 'saved' ? '저장됨' : '';

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        title={headerTitle}
        left={<IconButton icon="back" label="뒤로" onPress={() => router.back()} />}
        right={
          <>
            <IconButton
              icon={memo?.isFavorite ? 'starFill' : 'star'}
              label={memo?.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
              color={memo?.isFavorite ? colors.favorite : colors.textSecondary}
              onPress={() => {
                void withSavedMemo(() => toggleFavorite(memoId));
              }}
            />
            <IconButton
              icon={memo?.isPinned ? 'pinFill' : 'pin'}
              label={memo?.isPinned ? '고정 해제' : '고정'}
              color={memo?.isPinned ? colors.accent : colors.textSecondary}
              onPress={() => {
                void withSavedMemo(() => togglePin(memoId));
              }}
            />
            <IconButton icon="trash" label="삭제" color={colors.textSecondary} onPress={onDelete} />
          </>
        }
      />
      {memo?.isDeleted ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void restore(memo.id);
          }}
          style={[styles.banner, { backgroundColor: colors.dangerSoft }]}>
          <Text style={[styles.bannerText, { color: colors.danger }]}>휴지통에 있는 메모예요. 복원하기</Text>
        </Pressable>
      ) : null}
      <KeyboardAvoidingView style={styles.editor} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TextInput
          value={draft.title}
          onChangeText={(title) => updateDraft({ title })}
          placeholder="제목"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          returnKeyType="next"
          onSubmitEditing={() => contentRef.current?.focus()}
          style={[styles.title, { color: colors.text }]}
        />
        <TagEditor tags={draft.tags} onChange={(tags) => updateDraft({ tags })} />
        <TextInput
          ref={contentRef}
          value={draft.content}
          onChangeText={(content) => updateDraft({ content })}
          placeholder="지금 떠오른 생각을 적어보세요"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          multiline
          textAlignVertical="top"
          style={[styles.content, { color: colors.text }]}
        />
        {memo ? (
          <Text style={[styles.meta, { color: colors.textTertiary }]}>
            {`생성 ${formatFullDate(memo.createdAt)}  ·  수정 ${formatRelativeTime(memo.updatedAt)}`}
          </Text>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  editor: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  title: {
    ...typography.title,
    paddingVertical: spacing.sm,
  },
  content: {
    ...typography.body,
    flex: 1,
    paddingTop: spacing.sm,
  },
  meta: {
    ...typography.caption,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  banner: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  bannerText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
