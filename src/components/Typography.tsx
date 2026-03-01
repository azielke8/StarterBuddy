import React from 'react';
import { Text as RNText, TextStyle, StyleProp, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface TypographyProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export function Heading({ children, style, ...rest }: TypographyProps) {
  const { theme } = useTheme();
  return (
    <RNText
      style={[
        styles.heading,
        {
          color: theme.colors.text,
          fontFamily: theme.typography.headingFamily,
          fontSize: theme.typography.sizes.xl,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export function Subheading({ children, style, ...rest }: TypographyProps) {
  const { theme } = useTheme();
  return (
    <RNText
      style={[
        styles.subheading,
        {
          color: theme.colors.textSecondary,
          fontSize: theme.typography.sizes.md,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export function Body({ children, style, ...rest }: TypographyProps) {
  const { theme } = useTheme();
  return (
    <RNText
      style={[
        {
          color: theme.colors.text,
          fontSize: theme.typography.sizes.md,
          lineHeight: 22,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export function Caption({ children, style, ...rest }: TypographyProps) {
  const { theme } = useTheme();
  return (
    <RNText
      style={[
        {
          color: theme.colors.textSecondary,
          fontSize: theme.typography.sizes.sm,
          lineHeight: 18,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export function Label({ children, style, ...rest }: TypographyProps) {
  const { theme } = useTheme();
  return (
    <RNText
      style={[
        {
          color: theme.colors.text,
          fontSize: theme.typography.sizes.sm,
          fontWeight: '600',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subheading: {
    fontWeight: '400',
  },
});
