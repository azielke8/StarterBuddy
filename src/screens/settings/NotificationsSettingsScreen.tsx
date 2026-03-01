import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';
import { Body, Caption } from '../../components/Typography';
import { Card } from '../../components/Card';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
} from '../../services/notificationService';

export function NotificationsSettingsScreen() {
  const { theme } = useTheme();
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  const [feedReminders, setFeedReminders] = useState(true);
  const [peakAlerts, setPeakAlerts] = useState(true);

  useEffect(() => {
    getNotificationPermissionStatus().then(setPermissionStatus);
  }, []);

  async function handleEnableNotifications() {
    const granted = await requestNotificationPermission();
    setPermissionStatus(granted ? 'granted' : 'denied');
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Card style={{ marginHorizontal: 0, marginBottom: 16 }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Body>Permission</Body>
            <Caption style={{ marginTop: 2 }}>
              {permissionStatus === 'granted'
                ? 'Notifications enabled'
                : permissionStatus === 'denied'
                ? 'Notifications denied — enable in iOS Settings'
                : 'Not yet requested'}
            </Caption>
          </View>
          {permissionStatus !== 'granted' && (
            <TouchableOpacity onPress={handleEnableNotifications}>
              <Body style={{ color: theme.colors.primary, fontWeight: '600' }}>
                Enable
              </Body>
            </TouchableOpacity>
          )}
        </View>
      </Card>

      <Card style={{ marginHorizontal: 0 }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Body>Feed reminders</Body>
            <Caption style={{ marginTop: 2 }}>Remind when it's time to refresh</Caption>
          </View>
          <Switch
            value={feedReminders}
            onValueChange={setFeedReminders}
            trackColor={{ true: theme.colors.success, false: theme.colors.border }}
          />
        </View>
        <View style={[styles.row, { marginTop: 16 }]}>
          <View style={{ flex: 1 }}>
            <Body>Peak alerts</Body>
            <Caption style={{ marginTop: 2 }}>Alert during optimal fermentation window</Caption>
          </View>
          <Switch
            value={peakAlerts}
            onValueChange={setPeakAlerts}
            trackColor={{ true: theme.colors.success, false: theme.colors.border }}
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
