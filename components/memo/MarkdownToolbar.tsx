import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import type { MarkdownAction } from '@/services/markdown';
import { spacing } from '@/theme/tokens';

const actions: { id: MarkdownAction; label: string }[] = [
  { id: 'h1', label: '제목' },
  { id: 'h2', label: '소제목' },
  { id: 'h3', label: '작은제목' },
  { id: 'bold', label: '굵게' },
  { id: 'italic', label: '기울임' },
  { id: 'bullet', label: '목록' },
  { id: 'task', label: '할 일' },
  { id: 'quote', label: '인용' },
  { id: 'hr', label: '구분선' },
  { id: 'link', label: '링크' },
];

type MarkdownToolbarProps = {
  preview: boolean;
  onAction: (action: MarkdownAction) => void;
  onImage: () => void;
  onTogglePreview: () => void;
  onOrganize: () => void;
  onDraft: () => void;
};

export function MarkdownToolbar({ preview, onAction, onImage, onTogglePreview, onOrganize, onDraft }: MarkdownToolbarProps) {
  return (
    <View style={styles.bar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
        {preview
          ? null
          : actions.map((action) => (
              <Chip key={action.id} label={action.label} onPress={() => onAction(action.id)} />
            ))}
        {preview ? null : <Chip label="사진" onPress={onImage} />}
        <Chip label={preview ? '편집' : '미리보기'} selected={preview} onPress={onTogglePreview} />
        <Chip label="생각 정리하기" onPress={onOrganize} />
        <Chip label="AI로 작성" onPress={onDraft} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: spacing.sm,
  },
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
});
