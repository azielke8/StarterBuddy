import React from 'react';
import { View, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, style }: CardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radii.xl,
          ...theme.shadows.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
  },
});
