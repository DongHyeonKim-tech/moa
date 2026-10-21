import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MarkdownEditor, type MarkdownEditorHandle } from '@/components/memo/MarkdownEditor';
import { MarkdownPreview } from '@/components/memo/MarkdownPreview';
import { MarkdownToolbar } from '@/components/memo/MarkdownToolbar';
import { OrganizeModeSheet } from '@/components/memo/OrganizeModeSheet';
import { RelatedMemos } from '@/components/memo/RelatedMemos';
import { TagEditor } from '@/components/memo/TagEditor';
import { IconButton } from '@/components/ui/IconButton';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { useAiConsent } from '@/hooks/useAiConsent';
import { deleteAttachmentFile, pickAndStoreImage } from '@/services/attachmentFiles';
import { userFacingError } from '@/services/dataError';
import { applyMarkdownAction, insertImageMarkdown, toggleTask, type MarkdownAction, type Selection } from '@/services/markdown';
import { flushMemoAnalysis, scheduleMemoAnalysis } from '@/services/memoAnalysis';
import { draftFromMemo, isBlankDraft } from '@/services/memoRules';
import { refreshRelated } from '@/services/relatedNoteService';
import { linkedMemoIds } from '@/services/relationRules';
import { useMemoStore } from '@/store/memoStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import type { AiInsertion, RelatedSuggestion } from '@/types/ai';
import type { Attachment, MemoDraft } from '@/types/memo';
import { formatFullDate, formatRelativeTime } from '@/utils/date';
import { contentFingerprint } from '@/utils/fingerprint';
import { displayTitle } from '@/utils/memoText';

const AUTOSAVE_MS = 700;
const emptySuggestions: RelatedSuggestion[] = [];

export default function MemoEditorScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { ensureConsent, consent } = useAiConsent();
  const params = useLocalSearchParams<{ id: string }>();
  const memoId = Array.isArray(params.id) ? params.id[0] : params.id;
  const memo = useMemoStore((state) => state.memos.find((item) => item.id === memoId) ?? null);
  const attachmentList = useMemoStore((state) => state.attachments);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const relations = useMemoStore((state) => state.relations);
  const sourceList = useMemoStore((state) => state.sources);
  const suggestionMap = useMemoStore((state) => state.suggestions);
  const attachments = useMemo(() => {
    const saved = attachmentList.filter((item) => item.memoId === memoId);
    const ids = new Set(saved.map((item) => item.id));
    return [...saved, ...pendingAttachments.filter((item) => item.memoId === memoId && !ids.has(item.id))];
  }, [attachmentList, memoId, pendingAttachments]);
  const sources = useMemo(
    () => sourceList.filter((item) => item.mergedMemoId === memoId),
    [memoId, sourceList],
  );
  const suggestions = (memoId ? suggestionMap[memoId] : undefined) ?? emptySuggestions;
  const memos = useMemoStore((state) => state.memos);
  const saveDraft = useMemoStore((state) => state.saveDraft);
  const toggleFavorite = useMemoStore((state) => state.toggleFavorite);
  const togglePin = useMemoStore((state) => state.togglePin);
  const moveToTrash = useMemoStore((state) => state.moveToTrash);
  const restore = useMemoStore((state) => state.restore);
  const removeAiTag = useMemoStore((state) => state.removeAiTag);
  const addAttachment = useMemoStore((state) => state.addAttachment);
  const linkMemos = useMemoStore((state) => state.linkMemos);
  const unlinkMemos = useMemoStore((state) => state.unlinkMemos);
  const aiInsertion = useMemoStore((state) => state.aiInsertion);

  const [draft, setDraft] = useState<MemoDraft>(() =>
    draftFromMemo(useMemoStore.getState().memos.find((item) => item.id === memoId)),
  );
  const [sessionId, setSessionId] = useState(memoId);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [preview, setPreview] = useState(false);
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const [forcedSelection, setForcedSelection] = useState<Selection | null>(null);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const draftRef = useRef(draft);
  const selectionRef = useRef(selection);
  const dirtyRef = useRef(false);
  const mountedRef = useRef(true);
  const contentRef = useRef<MarkdownEditorHandle>(null);
  const fingerprintRef = useRef(contentFingerprint(draft.title, draft.contentMarkdown));

  if (memoId && sessionId !== memoId) {
    const nextDraft = draftFromMemo(useMemoStore.getState().memos.find((item) => item.id === memoId));
    setSessionId(memoId);
    setDraft(nextDraft);
    setSaveState('idle');
    setPreview(false);
    dirtyRef.current = false;
    fingerprintRef.current = contentFingerprint(nextDraft.title, nextDraft.contentMarkdown);
  }

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!memoId || aiInsertion?.memoId !== memoId) {
      return;
    }
    const currentMemo = useMemoStore.getState().memos.find((item) => item.id === memoId);
    const taken: AiInsertion | null = useMemoStore.getState().consumeAiInsertion(memoId);
    if (!taken || currentMemo?.isDeleted) {
      return;
    }
    const current = draftRef.current;
    const contentMarkdown = current.contentMarkdown.trim()
      ? `${current.contentMarkdown.replace(/\s+$/, '')}\n\n${taken.markdown}`
      : taken.markdown;
    const next = {
      ...current,
      title: current.title.trim() ? current.title : taken.title,
      contentMarkdown,
    };
    dirtyRef.current = true;
    draftRef.current = next;
    setSaveState('saving');
    setDraft(next);
  }, [aiInsertion, memoId]);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

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
    void refreshRelated(memoId, { allowAi: true });
    void useMemoStore.getState().refreshAttachmentUrls(memoId).catch((error: unknown) => {
      useMemoStore.setState({ syncError: userFacingError(error) });
    });
  }, [memoId]);

  useEffect(() => {
    if (!dirtyRef.current || !memoId) {
      return undefined;
    }

    const timer = setTimeout(() => {
      const snapshot = draftRef.current;
      const previousFingerprint = fingerprintRef.current;
      void saveDraft(memoId, snapshot).then((result) => {
        if (!mountedRef.current) {
          return;
        }
        setSaveState(result === 'failed' ? 'error' : result === 'skipped' ? 'idle' : 'saved');
        if (result === 'saved') {
          const nextFingerprint = contentFingerprint(snapshot.title, snapshot.contentMarkdown);
          fingerprintRef.current = nextFingerprint;
          const tagsChanged = previousFingerprint === nextFingerprint;
          scheduleMemoAnalysis(memoId);
          void refreshRelated(memoId, { allowAi: tagsChanged });
        }
      });
    }, AUTOSAVE_MS);

    return () => clearTimeout(timer);
  }, [draft, memoId, saveDraft]);

  useEffect(() => {
    if (!memoId) {
      return undefined;
    }

    return () => {
      const dirty = dirtyRef.current;
      const snapshot = draftRef.current;
      dirtyRef.current = false;
      void (async () => {
        if (dirty) {
          await saveDraft(memoId, snapshot);
          scheduleMemoAnalysis(memoId, { immediate: true });
          return;
        }
        flushMemoAnalysis(memoId);
      })();
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

  const applyAction = (action: MarkdownAction, url?: string) => {
    const next = applyMarkdownAction(draftRef.current.contentMarkdown, selectionRef.current, action, { url });
    updateDraft({ contentMarkdown: next.text });
    setSelection(next.selection);
    setForcedSelection(next.selection);
  };

  const onInsertImage = async () => {
    if (!memoId) {
      return;
    }
    try {
      const image = await pickAndStoreImage();
      if (!image) {
        return;
      }
      const next = insertImageMarkdown(draftRef.current.contentMarkdown, selectionRef.current, image.id);
      const nextDraft = { ...draftRef.current, contentMarkdown: next.text };
      const optimistic: Attachment = {
        id: image.id,
        memoId,
        localUri: image.localUri,
        mimeType: image.mimeType,
        fileName: image.fileName,
        createdAt: new Date().toISOString(),
      };
      draftRef.current = nextDraft;
      dirtyRef.current = true;
      setPendingAttachments((current) => [...current, optimistic]);
      setDraft(nextDraft);
      setSelection(next.selection);
      setForcedSelection(next.selection);
      setSaveState('saving');
      const result = await saveDraft(memoId, nextDraft);
      if (result === 'skipped' || result === 'failed') {
        deleteAttachmentFile(image.localUri);
        setPendingAttachments((current) => current.filter((item) => item.id !== image.id));
        if (mountedRef.current) {
          setSaveState(result === 'failed' ? 'error' : 'idle');
        }
        return;
      }
      await addAttachment(optimistic);
      setPendingAttachments((current) => current.filter((item) => item.id !== image.id));
      if (mountedRef.current) {
        setSaveState('saved');
      }
    } catch (error) {
      Alert.alert('사진을 넣지 못했어요', userFacingError(error));
    }
  };

  const confirmLink = () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      Alert.alert('링크 주소가 필요해요', 'http 또는 https로 시작하는 주소를 입력해 주세요.');
      return;
    }
    applyAction('link', url);
    setLinkOpen(false);
  };

  const openOrganize = async () => {
    if (!memoId) {
      return;
    }
    const agreed = await ensureConsent();
    if (!agreed) {
      return;
    }
    const result = await saveDraft(memoId, draftRef.current);
    if (result === 'skipped' || isBlankDraft(draftRef.current)) {
      Alert.alert('정리할 내용이 없어요', '먼저 떠오른 생각을 적어 주세요.');
      return;
    }
    setOrganizeOpen(true);
  };

  if (!memoId) {
    return null;
  }

  const headerTitle =
    saveState === 'saving' ? '저장 중' : saveState === 'error' ? '저장 실패' : saveState === 'saved' ? '저장됨' : '';
  const aiTags = memo?.tags.filter((tag) => tag.source === 'AI') ?? [];
  const linked = linkedMemoIds(memoId, relations)
    .map((id) => memos.find((item) => item.id === id && !item.isDeleted))
    .flatMap((item) => (item ? [item] : []));
  const suggestionRows = suggestions.flatMap((suggestion) => {
    const related = memos.find((item) => item.id === suggestion.memoId && !item.isDeleted);
    return related ? [{ suggestion, memo: related }] : [];
  });
  const sourceMemos = sources
    .slice()
    .sort((left, right) => left.position - right.position)
    .map((source) => ({
      id: source.sourceMemoId,
      memo: memos.find((item) => item.id === source.sourceMemoId) ?? null,
    }));

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
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
          <TagEditor tags={draft.userTags} onChange={(userTags) => updateDraft({ userTags })} />
          {aiTags.length > 0 ? (
            <View style={styles.aiTags}>
              {aiTags.map((tag) => (
                <Pressable
                  key={tag.name}
                  accessibilityRole="button"
                  accessibilityLabel={`${tag.name} 제안 태그 삭제`}
                  onPress={() => {
                    void removeAiTag(memoId, tag.name);
                  }}
                  style={[styles.aiTag, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.aiTagLabel, { color: colors.textSecondary }]}>{`#${tag.name} · AI`}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {memo?.aiSummary ? <Text style={[styles.summary, { color: colors.textSecondary }]}>{memo.aiSummary}</Text> : null}
          {memo?.aiAnalysisStatus === 'pending' ? (
            <Text style={[styles.hint, { color: colors.textTertiary }]}>요약을 만들고 있어요</Text>
          ) : null}
          {memo?.aiAnalysisStatus === 'failed' ? (
            <Pressable onPress={() => scheduleMemoAnalysis(memoId, { immediate: true })}>
              <Text style={[styles.hint, { color: colors.danger }]}>요약을 만들지 못했어요. 다시 시도</Text>
            </Pressable>
          ) : null}
          {!consent && draft.contentMarkdown.trim().length > 0 ? (
            <Pressable onPress={() => router.push('/settings')}>
              <Text style={[styles.hint, { color: colors.textTertiary }]}>AI 요약은 설정에서 켤 수 있어요.</Text>
            </Pressable>
          ) : null}
          {preview ? (
            <MarkdownPreview
              markdown={draft.contentMarkdown}
              attachments={attachments}
              onToggleTask={(line) => updateDraft({ contentMarkdown: toggleTask(draft.contentMarkdown, line) })}
            />
          ) : (
            <MarkdownEditor
              ref={contentRef}
              value={draft.contentMarkdown}
              attachments={attachments}
              onChangeText={(contentMarkdown) => updateDraft({ contentMarkdown })}
              onSelectionChange={(next) => {
                setForcedSelection(null);
                setSelection(next);
              }}
              selection={forcedSelection}
              placeholder="지금 떠오른 생각을 적어보세요"
            />
          )}
          {memo ? (
            <RelatedMemos
              linked={linked.map((item) => ({
                memo: item,
                actionLabel: '연결 해제',
                onOpen: () => router.push({ pathname: '/memo/[id]', params: { id: item.id } }),
                onAction: () => {
                  void unlinkMemos(memoId, item.id);
                },
              }))}
              suggestions={suggestionRows}
              onOpenSuggestion={(item) => router.push({ pathname: '/memo/[id]', params: { id: item.id } })}
              onLink={(id) => {
                void linkMemos(memoId, id);
              }}
              onRefresh={() => {
                void (async () => {
                  const agreed = await ensureConsent();
                  await refreshRelated(memoId, { allowAi: agreed, force: true });
                })();
              }}
            />
          ) : null}
          {sourceMemos.length > 0 ? (
            <View style={styles.sources}>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>이 기록은 아래 메모를 모았어요. 원본은 그대로예요.</Text>
              {sourceMemos.map((source) => (
                <Pressable
                  key={source.id}
                  accessibilityRole="button"
                  disabled={!source.memo || source.memo.isDeleted}
                  onPress={() => router.push({ pathname: '/memo/[id]', params: { id: source.id } })}>
                  <Text style={[styles.sourceLink, { color: colors.accentText }]}>
                    {source.memo && !source.memo.isDeleted ? displayTitle(source.memo) : '삭제된 메모'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {memo ? (
            <Text style={[styles.meta, { color: colors.textTertiary }]}>
              {`생성 ${formatFullDate(memo.createdAt)}  ·  수정 ${formatRelativeTime(memo.updatedAt)}`}
            </Text>
          ) : null}
        </ScrollView>
        {memo?.isDeleted ? null : (
          <MarkdownToolbar
            preview={preview}
            onAction={(action) => {
              if (action === 'link') {
                setLinkUrl('https://');
                setLinkOpen(true);
                return;
              }
              applyAction(action);
            }}
            onImage={() => {
              void onInsertImage();
            }}
            onTogglePreview={() => setPreview((current) => !current)}
            onOrganize={() => {
              void openOrganize();
            }}
            onDraft={() => router.push({ pathname: '/draft', params: { memoId } })}
          />
        )}
      </KeyboardAvoidingView>
      <OrganizeModeSheet
        visible={organizeOpen}
        onClose={() => setOrganizeOpen(false)}
        onSelect={(mode) => {
          setOrganizeOpen(false);
          router.push({ pathname: '/organize/[id]', params: { id: memoId, mode } });
        }}
      />
      <Modal visible={linkOpen} transparent animationType="fade" onRequestClose={() => setLinkOpen(false)}>
        <View style={styles.modalFill}>
          <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={() => setLinkOpen(false)} />
          <View style={[styles.dialog, { backgroundColor: colors.surface }]}>
            <Text style={[styles.dialogTitle, { color: colors.text }]}>링크 주소</Text>
            <TextInput
              value={linkUrl}
              onChangeText={setLinkUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.accent}
              style={[styles.dialogInput, { color: colors.text, borderColor: colors.border }]}
            />
            <View style={styles.dialogActions}>
              <Pressable accessibilityRole="button" onPress={() => setLinkOpen(false)}>
                <Text style={[styles.dialogAction, { color: colors.textSecondary }]}>취소</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={confirmLink}>
                <Text style={[styles.dialogAction, { color: colors.accentText }]}>넣기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  editor: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.title,
    paddingVertical: spacing.sm,
  },
  meta: {
    ...typography.caption,
    paddingTop: spacing.lg,
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
  aiTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  aiTag: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  aiTagLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  summary: {
    ...typography.preview,
    paddingBottom: spacing.sm,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    paddingBottom: spacing.sm,
  },
  sources: {
    gap: spacing.xs,
    paddingTop: spacing.lg,
  },
  sourceLink: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  modalFill: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  dialog: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  dialogTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  dialogInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
  },
  dialogAction: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
});
