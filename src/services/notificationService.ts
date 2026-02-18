import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export async function getNotificationPermissionStatus(): Promise<string> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function scheduleFeedReminder(
  starterId: string,
  starterName: string,
  intervalHours: number
): Promise<string> {
  // Cancel existing feed reminders for this starter
  await cancelStarterNotifications(starterId, 'feed');

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to refresh your culture.',
      body: `${starterName} is ready for a feeding.`,
      data: { starterId, type: 'feed' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: intervalHours * 60 * 60,
      repeats: false,
    },
  });

  return id;
}

export async function schedulePeakNotification(
  starterId: string,
  starterName: string,
  peakDate: Date
): Promise<string | null> {
  // Schedule at the start of the peak window (30 min before estimated peak)
  const triggerDate = new Date(peakDate.getTime() - 30 * 60 * 1000);

  if (triggerDate.getTime() <= Date.now()) {
    return null; // Already past
  }

  // Cancel existing peak notifications for this starter
  await cancelStarterNotifications(starterId, 'peak');

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Optimal fermentation window.',
      body: 'Your culture may be ready.',
      data: { starterId, type: 'peak' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  return id;
}

export async function cancelStarterNotifications(
  starterId: string,
  type?: 'feed' | 'peak'
): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    const data = notif.content.data as any;
    if (data?.starterId === starterId && (!type || data?.type === type)) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
