import { Image } from 'expo-image';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import {
  absoluteSelection,
  editorPieces,
  markdownWithoutImage,
  replaceShownText,
  selectionInPiece,
  shownText,
  type Selection,
} from '@/services/markdown';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import type { Attachment } from '@/types/memo';

export type MarkdownEditorHandle = {
  focus: () => void;
};

type MarkdownEditorProps = {
  value: string;
  attachments: readonly Attachment[];
  onChangeText: (value: string) => void;
  onSelectionChange: (selection: Selection) => void;
  selection: Selection | null;
  placeholder?: string;
};

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor(
  { value, attachments, onChangeText, onSelectionChange, selection, placeholder },
  ref,
) {
  const { colors } = useTheme();
  const pieces = editorPieces(value);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const located = selection ? selectionInPiece(pieces, selection) : null;
  const hasImage = pieces.some((piece) => piece.kind === 'image');
  const firstTextIndex = pieces.findIndex((piece) => piece.kind === 'text');

  useImperativeHandle(ref, () => ({
    focus() {
      const index = firstTextIndex >= 0 ? firstTextIndex : 0;
      inputRefs.current[index]?.focus();
    },
  }));

  useEffect(() => {
    if (!selection) {
      return;
    }
    const fallback = pieces.reduce((found, piece, pieceIndex) => (piece.kind === 'text' ? pieceIndex : found), -1);
    const index = located?.pieceIndex ?? fallback;
    if (index >= 0) {
      inputRefs.current[index]?.focus();
    }
  }, [located?.pieceIndex, selection]);

  return (
    <View style={styles.wrap}>
      {pieces.map((piece, index) => {
        if (piece.kind === 'image') {
          const attachment = attachments.find((item) => item.id === piece.id);
          return (
            <View key={`image-${piece.id}-${index}`} style={styles.imageWrap}>
              {attachment?.localUri ? (
                <Image
                  source={{ uri: attachment.localUri }}
                  style={[styles.image, { backgroundColor: colors.surfaceMuted }]}
                  contentFit="cover"
                  accessibilityLabel={piece.alt}
                />
              ) : (
                <View style={[styles.missing, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.missingLabel, { color: colors.textTertiary }]}>사진을 찾을 수 없어요</Text>
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="사진 삭제"
                hitSlop={8}
                onPress={() => onChangeText(markdownWithoutImage(value, piece.id))}
                style={[styles.remove, { backgroundColor: colors.surface }]}>
                <Icon name="close" color={colors.textSecondary} size={16} />
              </Pressable>
            </View>
          );
        }

        const shown = shownText(piece);
        const isLast = index === pieces.length - 1;
        const minHeight = !hasImage ? Math.max(240, heights[index] ?? 0) : isLast ? Math.max(120, heights[index] ?? 0) : Math.max(28, heights[index] ?? 0);
        return (
          <TextInput
            key={`text-${index}`}
            ref={(node) => {
              inputRefs.current[index] = node;
            }}
            value={shown}
            onChangeText={(next) => onChangeText(replaceShownText(pieces, index, next))}
            onSelectionChange={(event) => {
              onSelectionChange(absoluteSelection(pieces, index, event.nativeEvent.selection));
            }}
            selection={located?.pieceIndex === index ? located.selection : undefined}
            onContentSizeChange={(event) => {
              const next = Math.ceil(event.nativeEvent.contentSize.height);
              setHeights((current) => (current[index] === next ? current : { ...current, [index]: next }));
            }}
            placeholder={index === firstTextIndex && value.length === 0 ? placeholder : undefined}
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            style={[styles.content, { color: colors.text, minHeight }]}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.sm,
  },
  content: {
    ...typography.body,
  },
  imageWrap: {
    marginVertical: spacing.sm,
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
  },
  missing: {
    width: '100%',
    height: 120,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingLabel: {
    ...typography.caption,
  },
  remove: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
