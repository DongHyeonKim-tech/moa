import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { OrganizeMode } from '@/types/ai';

export const organizeModes: { id: OrganizeMode; label: string; description: string }[] = [
  { id: 'tidy', label: '깔끔하게 정리', description: '제목과 항목으로 보기 쉽게' },
  { id: 'checklist', label: '할 일 목록', description: '해야 할 일을 체크리스트로' },
  { id: 'prose', label: '문장으로 정리', description: '짧은 글로 자연스럽게' },
  { id: 'summary', label: '핵심만 요약', description: '긴 내용을 짧게' },
];

type OrganizeModeSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (mode: OrganizeMode) => void;
};

export function OrganizeModeSheet({ visible, onClose, onSelect }: OrganizeModeSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable accessibilityLabel="닫기" style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Text style={[styles.title, { color: colors.text }]}>어떻게 정리할까요?</Text>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>정리 결과는 확인한 뒤에 적용할 수 있어요.</Text>
          {organizeModes.map((mode) => (
            <Pressable
              key={mode.id}
              accessibilityRole="button"
              onPress={() => onSelect(mode.id)}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceMuted : colors.surface }]}>
              <Text style={[styles.label, { color: colors.text }]}>{mode.label}</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>{mode.description}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>닫기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    paddingHorizontal: spacing.xl,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  row: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: 2,
  },
  label: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
});
