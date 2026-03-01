import React from 'react';
import { View, ScrollView, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';
import { Body, Caption } from '../../components/Typography';
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
          {isPro ? (
            <Switch
              value={isDark}
              onValueChange={handleToggleDarkMode}
              trackColor={{ true: theme.colors.success, false: theme.colors.border }}
            />
          ) : (
            <TouchableOpacity onPress={() => navigation.navigate('Subscription')}>
              <Caption style={{ color: theme.colors.primary, fontWeight: '600' }}>Upgrade</Caption>
            </TouchableOpacity>
          )}
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
