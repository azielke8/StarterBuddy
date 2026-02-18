import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { Heading, Body, Caption, Label } from '../../components/Typography';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { getStarter, getEventsForStarter, deleteStarter } from '../../db';
import { Starter, StarterEvent } from '../../models/types';
import { formatDuration } from '../../utils/feedCalculations';
import { HomeStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'StarterDetail'>;

export function StarterDetailScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { starterId } = route.params;
  const [starter, setStarter] = useState<Starter | null>(null);
  const [events, setEvents] = useState<StarterEvent[]>([]);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const s = await getStarter(starterId);
        setStarter(s);
        const e = await getEventsForStarter(starterId, 20);
        setEvents(e);
      }
      load();
    }, [starterId])
  );

  function handleDelete() {
    Alert.alert(
      'Remove culture',
      `This will permanently remove ${starter?.name} and all its history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteStarter(starterId);
            navigation.goBack();
          },
        },
      ]
    );
  }

  if (!starter) return null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Heading style={{ marginBottom: 4 }}>{starter.name}</Heading>
      <Caption style={{ marginBottom: 24 }}>
        {starter.storage_mode === 'fridge' ? 'Fridge' : 'Counter'} &middot;{' '}
        {starter.hydration_target}% hydration &middot;{' '}
        {starter.preferred_ratio_a}:{starter.preferred_ratio_b}:{starter.preferred_ratio_c}
      </Caption>

      <Card style={{ marginHorizontal: 0, marginBottom: 16 }}>
        <Label style={{ marginBottom: 8 }}>Details</Label>
        <View style={styles.detailRow}>
          <Caption>Flour</Caption>
          <Body>{starter.flour_type}</Body>
        </View>
        <View style={styles.detailRow}>
          <Caption>Feed interval</Caption>
          <Body>{formatDuration(starter.default_feed_interval_hours)}</Body>
        </View>
        {starter.baseline_peak_hours && (
          <View style={styles.detailRow}>
            <Caption>Avg. peak time</Caption>
            <Body>{formatDuration(starter.baseline_peak_hours)}</Body>
          </View>
        )}
      </Card>

      <View style={styles.actions}>
        <Button
          title="Feed"
          onPress={() => navigation.navigate('FeedWizard', { starterId })}
          style={{ flex: 1, marginRight: 8 }}
        />
        <Button
          title="Edit"
          variant="secondary"
          onPress={() => navigation.navigate('EditStarter', { mode: 'edit', starterId })}
          style={{ flex: 1, marginLeft: 8 }}
        />
      </View>

      <Label style={{ marginTop: 24, marginBottom: 12 }}>Recent Activity</Label>
      {events.length === 0 ? (
        <Caption>No events yet.</Caption>
      ) : (
        events.map((event) => (
          <Card key={event.id} style={{ marginHorizontal: 0, marginBottom: 8, padding: 14 }}>
            <View style={styles.eventRow}>
              <View>
                <Body style={{ fontWeight: '600' }}>{event.type}</Body>
                <Caption>
                  {new Date(event.timestamp).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Caption>
              </View>
              {event.ratio_string && (
                <Body style={{ color: theme.colors.textSecondary }}>{event.ratio_string}</Body>
              )}
            </View>
            {event.notes && <Caption style={{ marginTop: 6 }}>{event.notes}</Caption>}
          </Card>
        ))
      )}

      <TouchableOpacity
        style={styles.deleteLink}
        onPress={handleDelete}
        activeOpacity={0.7}
      >
        <Caption style={{ color: theme.colors.danger }}>Remove culture</Caption>
      </TouchableOpacity>
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8,
  },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteLink: {
    alignItems: 'center',
    marginTop: 32,
    paddingVertical: 12,
  },
});
