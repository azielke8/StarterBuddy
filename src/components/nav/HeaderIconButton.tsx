import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

interface HeaderIconButtonProps {
  onPress: () => void;
  iconName: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  variant?: 'bubble';
}

export function HeaderIconButton({
  onPress,
  iconName,
  accessibilityLabel,
  variant = 'bubble',
}: HeaderIconButtonProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        variant === 'bubble'
          ? {
              backgroundColor: theme.colors.inputBackground,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.full,
              borderWidth: 1,
            }
          : null,
        pressed ? { opacity: 0.8 } : null,
      ]}
    >
      <Ionicons name={iconName} size={18} color={theme.colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
});
