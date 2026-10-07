import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { addTagsFromInput, removeTag } from '@/services/memoRules';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

type TagEditorProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
};

export function TagEditor({ tags, onChange }: TagEditorProps) {
  const { colors } = useTheme();
  const [input, setInput] = useState('');

  const commit = (raw: string) => {
    const next = addTagsFromInput(tags, raw);
    if (next.length !== tags.length || next.some((tag, index) => tag !== tags[index])) {
      onChange(next);
    }
    setInput('');
  };

  return (
    <View style={styles.wrap}>
      {tags.map((tag) => (
        <Pressable
          key={tag}
          accessibilityRole="button"
          accessibilityLabel={`${tag} 태그 삭제`}
          onPress={() => onChange(removeTag(tags, tag))}
          style={[styles.tag, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.tagLabel, { color: colors.accentText }]}>{`#${tag}`}</Text>
          <Text style={[styles.remove, { color: colors.accentText }]}>×</Text>
        </Pressable>
      ))}
      <TextInput
        value={input}
        onChangeText={(value) => {
          if (value.includes(',') || value.includes('，')) {
            commit(value);
            return;
          }
          setInput(value);
        }}
        onSubmitEditing={() => commit(input)}
        onKeyPress={({ nativeEvent }) => {
          if (nativeEvent.key === 'Backspace' && input.length === 0 && tags.length > 0) {
            const last = tags[tags.length - 1];
            if (last) {
              onChange(removeTag(tags, last));
            }
          }
        }}
        placeholder={tags.length === 0 ? '태그 입력 후 엔터' : '태그 추가'}
        placeholderTextColor={colors.textTertiary}
        returnKeyType="done"
        blurOnSubmit={false}
        style={[styles.input, { color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  tagLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  remove: {
    fontSize: 16,
    lineHeight: 18,
  },
  input: {
    minWidth: 120,
    flexGrow: 1,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: spacing.xs,
  },
});
