import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ButtonProps) {
  const { theme } = useTheme();

  const buttonStyles: ViewStyle[] = [styles.base, { height: theme.button.height, borderRadius: theme.radii.md }];
  const textStyles: TextStyle[] = [styles.text];

  switch (variant) {
    case 'primary':
      buttonStyles.push({
        backgroundColor: theme.colors.primary,
        ...theme.shadows.button,
      });
      textStyles.push({ color: theme.colors.textInverse });
      break;
    case 'secondary':
      buttonStyles.push({
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: theme.colors.primary,
      });
      textStyles.push({ color: theme.colors.primary });
      break;
    case 'text':
      buttonStyles.push({ backgroundColor: 'transparent' });
      textStyles.push({ color: theme.colors.primary });
      break;
    case 'danger':
      buttonStyles.push({
        backgroundColor: theme.colors.danger,
        ...theme.shadows.button,
      });
      textStyles.push({ color: theme.colors.textInverse });
      break;
  }

  if (disabled) {
    buttonStyles.push({ opacity: 0.5 });
  }

  return (
    <TouchableOpacity
      style={[...buttonStyles, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.colors.textInverse : theme.colors.primary} />
      ) : (
        <Text style={[...textStyles, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
