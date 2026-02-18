import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Heading, Body, Caption } from '../../components/Typography';
import { Card } from '../../components/Card';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { SettingsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'SettingsMain'>;

interface SettingsRow {
  title: string;
  subtitle?: string;
  screen: keyof SettingsStackParamList;
  proOnly?: boolean;
}

const ROWS: SettingsRow[] = [
  { title: 'Notifications', subtitle: 'Feed reminders and peak alerts', screen: 'NotificationsSettings' },
  { title: 'Appearance', subtitle: 'Dark Mode (Pro)', screen: 'Appearance', proOnly: false },
  { title: 'Export & Import', subtitle: 'Back up your data', screen: 'ExportImport' },
  { title: 'Subscription', subtitle: 'Manage your plan', screen: 'Subscription' },
  { title: 'About', subtitle: 'Version and legal', screen: 'About' },
];

export function SettingsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { isPro } = useSubscription();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Heading style={{ marginBottom: 24 }}>Settings</Heading>

      {!isPro && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Subscription')}
        >
          <Card style={{ marginHorizontal: 0, marginBottom: 16, backgroundColor: theme.colors.primary }}>
            <Body style={{ color: theme.colors.textInverse, fontWeight: '600', marginBottom: 4 }}>
              Join Baker's Table
            </Body>
            <Caption style={{ color: theme.colors.textInverse, opacity: 0.85 }}>
              Unlock unlimited starters, dark mode, and more.
            </Caption>
          </Card>
        </TouchableOpacity>
      )}

      <Card style={{ marginHorizontal: 0, padding: 0 }}>
        {ROWS.map((row, index) => (
          <TouchableOpacity
            key={row.screen}
            style={[
              styles.row,
              index < ROWS.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
            ]}
            onPress={() => navigation.navigate(row.screen)}
            activeOpacity={0.6}
          >
            <View>
              <Body>{row.title}</Body>
              {row.subtitle && <Caption style={{ marginTop: 2 }}>{row.subtitle}</Caption>}
            </View>
            <Body style={{ color: theme.colors.textSecondary }}>›</Body>
          </TouchableOpacity>
        ))}
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
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
});
