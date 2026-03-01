import React, { useState, useCallback } from 'react';
import { View, StyleSheet, SectionList, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { Body, Caption, Label } from '../../components/Typography';
import { Card } from '../../components/Card';
import { Banner } from '../../components/Banner';
import { deleteEvent, getAllStarters, getAllEvents } from '../../db';
import { StarterEvent } from '../../models/types';
import {
  SCREEN_HPAD,
  SECTION_GAP,
  CARD_GAP,
  CARD_PAD_COMPACT,
  ROW_PAD_Y_COMPACT,
} from '../../theme/spacing';
import { formatTimelineNotes } from '../../utils/timelineFormat';
import { getStarterColor } from '../../utils/starterColor';

interface TimelineSection {
  title: string;
  data: (StarterEvent & { starterName?: string; starterColor?: string | null })[];
}

export function TimelineScreen() {
  const { theme } = useTheme();
  const [sections, setSections] = useState<TimelineSection[]>([]);
  const [showDeletedBanner, setShowDeletedBanner] = useState(false);

  const loadTimeline = useCallback(async () => {
    const starters = await getAllStarters();
    const starterMap = new Map(starters.map((s) => [s.id, { name: s.name, color: getStarterColor(s) }]));
    const events = await getAllEvents();

    // Group by date
    const grouped = new Map<string, (StarterEvent & { starterName?: string; starterColor?: string | null })[]>();
    for (const event of events) {
      const date = new Date(event.timestamp).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
      const starterInfo = starterMap.get(event.starter_id);
      const enriched = {
        ...event,
        starterName: starterInfo?.name,
        starterColor: starterInfo?.color ?? null,
      };
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(enriched);
    }

    const sectionList: TimelineSection[] = Array.from(grouped.entries()).map(
      ([title, data]) => ({ title, data })
    );
    setSections(sectionList);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTimeline();
    }, [loadTimeline])
  );

  function handleLongPressDelete(eventId: string) {
    Alert.alert('Delete event?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEvent(eventId);
            await loadTimeline();
            setShowDeletedBanner(true);
          } catch (error) {
            console.error('Failed to delete event:', error);
          }
        },
      },
    ]);
  }

  function getEventIcon(type: string): string {
    switch (type) {
      case 'FEED':
        return 'Refreshed';
      case 'BAKE':
        return 'Baked';
      case 'DISCARD':
        return 'Discarded';
      case 'NOTE':
        return 'Note';
      default:
        return type;
    }
  }

  return (
    <SectionList
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View>
          {showDeletedBanner && (
            <Banner
              message="Deleted"
              variant="success"
              onDismiss={() => setShowDeletedBanner(false)}
            />
          )}
          <Caption
            style={{
              textAlign: 'center',
              marginBottom: SECTION_GAP,
              color: theme.colors.textMuted ?? theme.colors.textSecondary,
            }}
          >
            All activity across your cultures
          </Caption>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Label style={{ ...styles.sectionHeader, color: theme.colors.textSecondary }}>
          {section.title}
        </Label>
      )}
      renderItem={({ item }) => (
        (() => {
          const formatted = item.notes ? formatTimelineNotes(item.notes) : null;
          const hasSystemMetadataPrefix =
            !!item.notes &&
            (item.notes.startsWith('LEV_START|') ||
              item.notes.startsWith('LEV_PEAK|') ||
              item.notes.startsWith('LEV_END|') ||
              item.notes.startsWith('LEV_USE|'));

          return (
            <TouchableOpacity activeOpacity={0.9} onLongPress={() => handleLongPressDelete(item.id)}>
              <Card
                style={{
                  marginHorizontal: 0,
                  marginBottom: CARD_GAP,
                  padding: CARD_PAD_COMPACT,
                }}
              >
                <View style={styles.eventContainer}>
                  <View style={styles.markerGutter}>
                    {item.starterColor ? (
                      <View style={[styles.markerBar, { backgroundColor: item.starterColor }]} />
                    ) : null}
                  </View>
                  <View style={styles.rowContent}>
                    <View style={styles.eventRow}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                          {item.starterColor ? (
                            <View style={[styles.colorDot, { backgroundColor: item.starterColor }]} />
                          ) : null}
                          <Body style={{ fontWeight: '600' }}>
                            {getEventIcon(item.type)}
                            {item.starterName ? ` — ${item.starterName}` : ''}
                          </Body>
                        </View>
                        <Caption>
                          {new Date(item.timestamp).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </Caption>
                      </View>
                      {item.ratio_string && (
                        <Body style={{ color: theme.colors.textSecondary }}>{item.ratio_string}</Body>
                      )}
                    </View>
                    {formatted?.systemSummary && (
                      <Caption style={{ marginTop: 4, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
                        {formatted.systemSummary}
                      </Caption>
                    )}
                    {formatted && formatted.displayNotes.length > 0 && (
                      <Caption style={{ marginTop: 6 }}>{formatted.displayNotes}</Caption>
                    )}
                    {item.peak_confirmed_hours != null &&
                      !(formatted?.systemSummary && hasSystemMetadataPrefix) && (
                      <Caption style={{ marginTop: 4, color: theme.colors.success }}>
                        Peak confirmed at {item.peak_confirmed_hours}h
                      </Caption>
                    )}
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })()
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Body style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
            No activity yet.{'\n'}Feed your culture to get started.
          </Body>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SCREEN_HPAD,
    paddingTop: ROW_PAD_Y_COMPACT,
    paddingBottom: 48,
  },
  sectionHeader: {
    marginTop: SECTION_GAP,
    marginBottom: 8,
  },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: ROW_PAD_Y_COMPACT,
  },
  eventContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  markerGutter: {
    width: 10,
    marginRight: 10,
    alignItems: 'center',
  },
  markerBar: {
    width: 5,
    borderRadius: 3,
    flex: 1,
  },
  rowContent: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  empty: {
    paddingTop: 60,
    alignItems: 'center',
  },
});
