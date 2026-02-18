import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface BannerProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  variant?: 'info' | 'success' | 'warning';
}

export function Banner({
  message,
  actionLabel,
  onAction,
  onDismiss,
  variant = 'info',
}: BannerProps) {
  const { theme } = useTheme();

  const accentColor =
    variant === 'success'
      ? theme.colors.success
      : variant === 'warning'
      ? theme.colors.accent
      : theme.colors.primary;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bannerBackground,
          borderLeftColor: accentColor,
          borderRadius: theme.radii.sm,
        },
      ]}
    >
      <Text style={[styles.message, { color: theme.colors.text }]}>{message}</Text>
      <View style={styles.actions}>
        {actionLabel && onAction && (
          <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
            <Text style={[styles.actionText, { color: accentColor }]}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn} activeOpacity={0.7}>
            <Text style={[styles.dismissText, { color: theme.colors.textSecondary }]}>Dismiss</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 14,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  message: {
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dismissBtn: {
    padding: 4,
  },
  dismissText: {
    fontSize: 13,
  },
});
