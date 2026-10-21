import { useCallback } from 'react';
import { Alert } from 'react-native';

import { scheduleRecentAnalyses } from '@/services/memoAnalysis';
import { useSettingsStore } from '@/store/settingsStore';

const MESSAGE =
  '생각 정리, 태그, 비슷한 메모, 모아보기, AI로 메모 쓰기에는 필요한 내용이 서버를 거쳐 외부 AI로 전달돼요. AI 키는 앱에 저장되지 않아요.';

export function useAiConsent() {
  const consent = useSettingsStore((state) => state.aiConsent);
  const setAiConsent = useSettingsStore((state) => state.setAiConsent);

  const ensureConsent = useCallback(async (): Promise<boolean> => {
    if (useSettingsStore.getState().aiConsent) {
      return true;
    }

    const accepted = await new Promise<boolean>((resolve) => {
      Alert.alert('AI를 사용할까요?', MESSAGE, [
        { text: '나중에', style: 'cancel', onPress: () => resolve(false) },
        { text: '동의하고 사용', onPress: () => resolve(true) },
      ]);
    });

    if (!accepted) {
      return false;
    }

    await setAiConsent(true);
    scheduleRecentAnalyses();
    return true;
  }, [setAiConsent]);

  return { consent, ensureConsent, message: MESSAGE };
}
