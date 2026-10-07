import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { activeMemos, deletedMemos } from '@/services/memoQuery';
import { useMemoStore } from '@/store/memoStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import type { ThemePreference } from '@/types/settings';

const themeOptions: { id: ThemePreference; label: string }[] = [
  { id: 'system', label: '시스템' },
  { id: 'light', label: '라이트' },
  { id: 'dark', label: '다크' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, preference, setPreference } = useTheme();
  const memos = useMemoStore((state) => state.memos);
  const memoCount = activeMemos(memos).length;
  const trashCount = deletedMemos(memos).length;

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        title="설정"
        left={<IconButton icon="back" label="뒤로" onPress={() => router.back()} />}
      />
      <View style={styles.body}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>화면 모드</Text>
        <View style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}>
          {themeOptions.map((option) => {
            const selected = preference === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  void setPreference(option.id);
                }}
                style={[styles.segmentItem, { backgroundColor: selected ? colors.surface : 'transparent' }]}>
                <Text style={[styles.segmentLabel, { color: selected ? colors.text : colors.textSecondary }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/trash')}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
          ]}>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>휴지통</Text>
            <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
              {trashCount > 0 ? `메모 ${trashCount}개` : '비어 있어요'}
            </Text>
          </View>
          <Icon name="chevronRight" color={colors.textTertiary} size={20} />
        </Pressable>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          {`메모 ${memoCount}개가 이 기기에 저장되어 있어요.`}
        </Text>
        <Text style={[styles.concept, { color: colors.textTertiary }]}>기록은 가볍게, 필요한 기억은 다시 돌아오게.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  segment: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  row: {
    marginTop: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
  rowDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  note: {
    marginTop: spacing.lg,
    fontSize: 14,
    lineHeight: 20,
  },
  concept: {
    fontSize: 14,
    lineHeight: 22,
  },
});
