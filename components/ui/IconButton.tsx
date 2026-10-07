import { Pressable, StyleSheet } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/theme/ThemeProvider';

type IconButtonProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
};

export function IconButton({ icon, label, onPress, color }: IconButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.55 : 1 }]}>
      <Icon name={icon} color={color ?? colors.text} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
