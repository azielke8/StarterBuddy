import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

interface HeaderIconButtonProps {
  onPress: () => void;
  iconName: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
}

export function HeaderIconButton({
  onPress,
  iconName,
  accessibilityLabel,
}: HeaderIconButtonProps) {
  const { theme, mode } = useTheme();
  const didLogRef = React.useRef(false);
  const previousThemeSignatureRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!__DEV__ || didLogRef.current) return;
    didLogRef.current = true;
    console.log(
      '[HeaderIconButton mount]',
      JSON.stringify({
        ts: Date.now(),
        mode,
        text: theme.colors.text,
      })
    );
  }, [mode, theme.colors.text]);

  React.useEffect(() => {
    if (!__DEV__) return;
    const signature = `${mode}|${theme.colors.text}`;
    if (previousThemeSignatureRef.current === null) {
      previousThemeSignatureRef.current = signature;
      return;
    }
    if (previousThemeSignatureRef.current !== signature) {
      previousThemeSignatureRef.current = signature;
      console.log(
        '[HeaderIconButton theme change]',
        JSON.stringify({
          ts: Date.now(),
          mode,
          text: theme.colors.text,
        })
      );
    }
  }, [mode, theme.colors.text]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.base, pressed ? { opacity: 0.8 } : null]}
    >
      <Ionicons name={iconName} size={20} color={theme.colors.text} />
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
