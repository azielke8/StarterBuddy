import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { Heading, Body, Caption } from '../../components/Typography';
import { Card } from '../../components/Card';

export function PlannerScreen() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Heading>Levain Planner</Heading>
        <Caption style={{ marginTop: 4 }}>Plan your bakes with precision</Caption>
      </View>

      <Card>
        <Body style={{ color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
          Levain planning tools are coming soon.{'\n'}
          Build and schedule levains for your bakes{'\n'}with calculated timing.
        </Body>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
});
