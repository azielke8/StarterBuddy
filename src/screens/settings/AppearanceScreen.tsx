import React from 'react';
import { View, ScrollView, StyleSheet, Switch } from 'react-native';
import { useTheme } from '../../theme';
import { Heading, Body, Caption } from '../../components/Typography';
import { Card } from '../../components/Card';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useNavigation } from '@react-navigation/native';

export function AppearanceScreen() {
  const { theme, mode, setMode, isDark } = useTheme();
  const { isPro } = useSubscription();
  const navigation = useNavigation<any>();

  function handleToggleDarkMode(value: boolean) {
    if (!isPro) {
      navigation.navigate('Subscription');
      return;
    }
    setMode(value ? 'dark' : 'light');
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Heading style={{ marginBottom: 24 }}>Appearance</Heading>

      <Card style={{ marginHorizontal: 0 }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Body>Dark Mode</Body>
            {!isPro && (
              <Caption style={{ marginTop: 2, color: theme.colors.accent }}>
                Available with Baker's Table
              </Caption>
            )}
          </View>
          <Switch
            value={isDark}
            onValueChange={handleToggleDarkMode}
            trackColor={{ true: theme.colors.success, false: theme.colors.border }}
            disabled={!isPro}
          />
        </View>
      </Card>
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
