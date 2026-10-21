import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { useAiConsent } from '@/hooks/useAiConsent';
import { checkAiHealth } from '@/services/aiClient';
import { cancelAllAnalyses } from '@/services/memoAnalysis';
import { activeMemos, deletedMemos } from '@/services/memoQuery';
import { useMemoStore } from '@/store/memoStore';
import { useSettingsStore } from '@/store/settingsStore';
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
  const { consent, ensureConsent, message } = useAiConsent();
  const setAiConsent = useSettingsStore((state) => state.setAiConsent);
  const proxyUrl = useSettingsStore((state) => state.aiProxyUrl);
  const proxyToken = useSettingsStore((state) => state.aiProxyToken);
  const setAiProxyUrl = useSettingsStore((state) => state.setAiProxyUrl);
  const setAiProxyToken = useSettingsStore((state) => state.setAiProxyToken);
  const [urlDraft, setUrlDraft] = useState(proxyUrl);
  const [tokenDraft, setTokenDraft] = useState(proxyToken);
  const [health, setHealth] = useState('확인 전');

  useEffect(() => {
    setUrlDraft(proxyUrl);
  }, [proxyUrl]);

  useEffect(() => {
    setTokenDraft(proxyToken);
  }, [proxyToken]);

  const refreshHealth = async () => {
    setHealth('확인 중');
    const result = await checkAiHealth();
    if (!result.reachable) {
      setHealth('서버에 연결하지 못했어요');
      return;
    }
    setHealth(result.aiConfigured ? 'AI를 사용할 수 있어요' : '서버는 켜져 있지만 AI 키가 없어요');
  };

  useEffect(() => {
    void refreshHealth();
  }, [proxyUrl, proxyToken]);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        title="설정"
        left={<IconButton icon="back" label="뒤로" onPress={() => router.back()} />}
      />
      <ScrollView contentContainerStyle={styles.body}>
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

        <View style={styles.aiHeader}>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>AI 기능</Text>
            <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>{message}</Text>
          </View>
          <Switch
            accessibilityLabel="AI 기능"
            value={consent}
            onValueChange={(value) => {
              if (value) {
                void ensureConsent();
                return;
              }
              cancelAllAnalyses();
              void setAiConsent(false);
            }}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
        <Text style={[styles.label, { color: colors.textSecondary }]}>AI 서버 주소</Text>
        <TextInput
          value={urlDraft}
          onChangeText={setUrlDraft}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://127.0.0.1:8787"
          placeholderTextColor={colors.textTertiary}
          onEndEditing={() => {
            const next = urlDraft.trim();
            if (next.startsWith('http://') || next.startsWith('https://')) {
              void setAiProxyUrl(next);
            } else {
              setUrlDraft(proxyUrl);
            }
          }}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        />
        <Text style={[styles.label, { color: colors.textSecondary }]}>접근 토큰</Text>
        <TextInput
          value={tokenDraft}
          onChangeText={setTokenDraft}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="서버에서 토큰을 켠 경우에만"
          placeholderTextColor={colors.textTertiary}
          onEndEditing={() => {
            void setAiProxyToken(tokenDraft.trim());
          }}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        />
        <Text style={[styles.note, { color: colors.textSecondary }]}>{`AI 상태: ${health}`}</Text>
        <Pressable accessibilityRole="button" onPress={() => void refreshHealth()}>
          <Text style={[styles.link, { color: colors.accent }]}>다시 확인</Text>
        </Pressable>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          {`메모 ${memoCount}개가 이 기기에 저장되어 있어요.`}
        </Text>
        <Text style={[styles.concept, { color: colors.textTertiary }]}>흩어진 생각을 모아, 하나의 기록으로.</Text>
        <Text style={[styles.concept, { color: colors.textTertiary }]}>{`moa ${Constants.expoConfig?.version ?? '1.0.0'}`}</Text>
      </ScrollView>
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
  aiHeader: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  link: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
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
