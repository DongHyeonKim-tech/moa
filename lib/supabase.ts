import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/types/database';

function requiredPublicEnv(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} 값이 없습니다.`);
  }
  return value;
}

export const supabase = createClient<Database>(
  requiredPublicEnv('EXPO_PUBLIC_SUPABASE_URL'),
  requiredPublicEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  {
    auth: {
      ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
