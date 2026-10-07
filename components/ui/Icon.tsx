import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';

const ICONS = {
  home: { ios: 'house', android: 'home', web: 'home' },
  notes: { ios: 'note.text', android: 'edit_note', web: 'edit_note' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  memories: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  pin: { ios: 'pin', android: 'push_pin', web: 'push_pin' },
  pinFill: { ios: 'pin.fill', android: 'push_pin', web: 'push_pin' },
  star: { ios: 'star', android: 'star_outline', web: 'star_outline' },
  starFill: { ios: 'star.fill', android: 'star', web: 'star' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  restore: { ios: 'arrow.uturn.backward', android: 'restore', web: 'restore' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
} as const;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  color: ColorValue;
  size?: number;
};

export function Icon({ name, color, size = 22 }: IconProps) {
  return <SymbolView name={ICONS[name]} tintColor={color} size={size} style={{ width: size, height: size }} />;
}
