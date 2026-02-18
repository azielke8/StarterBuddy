import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { Heading, Body, Caption } from '../../components/Typography';
import { Button } from '../../components/Button';

export function ProUpsellScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Heading style={{ fontSize: 26, textAlign: 'center', marginBottom: 12 }}>
          Levain Planner
        </Heading>
        <Body style={{ textAlign: 'center', color: theme.colors.textSecondary, lineHeight: 22, marginBottom: 32 }}>
          Plan levain builds, schedule bakes,{'\n'}and optimize your workflow.
        </Body>
        <Caption style={{ textAlign: 'center', color: theme.colors.textSecondary, marginBottom: 32 }}>
          Available with Baker's Table.
        </Caption>
        <Button
          title="Join Baker's Table"
          onPress={() => navigation.navigate('SettingsTab', { screen: 'Subscription' })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
});
