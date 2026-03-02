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
  const { theme, mode } = useTheme();
  const didLogRef = React.useRef(false);

  React.useEffect(() => {
    if (!__DEV__ || didLogRef.current) return;
    didLogRef.current = true;
    console.log(
      '[HeaderIconButton mount]',
      JSON.stringify({
        ts: Date.now(),
        mode,
        inputBackground: theme.colors.inputBackground,
        background: theme.colors.background,
        text: theme.colors.text,
        primary: theme.colors.primary,
        border: theme.colors.border,
      })
    );
  }, [mode, theme.colors.background, theme.colors.border, theme.colors.inputBackground, theme.colors.primary, theme.colors.text]);

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
