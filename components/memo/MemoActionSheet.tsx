import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { Memo } from '@/types/memo';
import { displayTitle } from '@/utils/memoText';

type MemoActionSheetProps = {
  memo: Memo | null;
  onClose: () => void;
  onTogglePin: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
};

export function MemoActionSheet({ memo, onClose, onTogglePin, onToggleFavorite, onDelete }: MemoActionSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={memo !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable accessibilityLabel="닫기" style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Text numberOfLines={1} style={[styles.caption, { color: colors.textSecondary }]}>
            {memo ? displayTitle(memo) : ''}
          </Text>
          <SheetAction label={memo?.isPinned ? '고정 해제' : '고정'} onPress={onTogglePin} />
          <SheetAction label={memo?.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'} onPress={onToggleFavorite} />
          <SheetAction label="삭제" tone="danger" onPress={onDelete} />
          <SheetAction label="닫기" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function SheetAction({
  label,
  onPress,
  tone = 'default',
}: {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: pressed ? colors.surfaceMuted : colors.surface }]}>
      <Text style={[styles.actionLabel, { color: tone === 'danger' ? colors.danger : colors.text }]}>{label}</Text>
    </Pressable>
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
    paddingTop: spacing.sm,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  action: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  actionLabel: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
  },
});
