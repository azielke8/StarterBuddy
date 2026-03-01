import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { Body, Caption } from '../../components/Typography';
import { Card } from '../../components/Card';

export function AboutScreen() {
  const { theme } = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Card style={{ marginHorizontal: 0 }}>
        <View style={styles.row}>
          <Caption>Version</Caption>
          <Body>1.0.0</Body>
        </View>
        <View style={[styles.row, { marginTop: 12 }]}>
          <Caption>Build</Caption>
          <Body>1</Body>
        </View>
      </Card>

      <Caption style={{ marginTop: 24, textAlign: 'center', lineHeight: 18 }}>
        StarterBuddy is built for bakers who{'\n'}take fermentation seriously.
      </Caption>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
