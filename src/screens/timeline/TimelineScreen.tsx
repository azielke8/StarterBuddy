import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, SectionList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { Heading, Body, Caption, Label } from '../../components/Typography';
import { Card } from '../../components/Card';
import { getAllStarters, getAllEvents } from '../../db';
import { Starter, StarterEvent } from '../../models/types';

interface TimelineSection {
  title: string;
  data: (StarterEvent & { starterName?: string })[];
}

export function TimelineScreen() {
  const { theme } = useTheme();
  const [sections, setSections] = useState<TimelineSection[]>([]);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const starters = await getAllStarters();
        const starterMap = new Map(starters.map((s) => [s.id, s.name]));
        const events = await getAllEvents();

        // Group by date
        const grouped = new Map<string, (StarterEvent & { starterName?: string })[]>();
        for (const event of events) {
          const date = new Date(event.timestamp).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          });
          const enriched = { ...event, starterName: starterMap.get(event.starter_id) };
          if (!grouped.has(date)) {
            grouped.set(date, []);
          }
          grouped.get(date)!.push(enriched);
        }

        const sectionList: TimelineSection[] = Array.from(grouped.entries()).map(
          ([title, data]) => ({ title, data })
        );
        setSections(sectionList);
      }
      load();
    }, [])
  );

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
        <View style={styles.header}>
          <Heading>Timeline</Heading>
          <Caption style={{ marginTop: 4 }}>All activity across your cultures</Caption>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Label style={{ ...styles.sectionHeader, color: theme.colors.textSecondary }}>
          {section.title}
        </Label>
      )}
      renderItem={({ item }) => (
        <Card style={{ marginHorizontal: 0, marginBottom: 8, padding: 14 }}>
          <View style={styles.eventRow}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '600' }}>
                {getEventIcon(item.type)}
                {item.starterName ? ` — ${item.starterName}` : ''}
              </Body>
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
          {item.notes && <Caption style={{ marginTop: 6 }}>{item.notes}</Caption>}
          {item.peak_confirmed_hours != null && (
            <Caption style={{ marginTop: 4, color: theme.colors.success }}>
              Peak confirmed at {item.peak_confirmed_hours}h
            </Caption>
          )}
        </Card>
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
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 8,
  },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  empty: {
    paddingTop: 60,
    alignItems: 'center',
  },
});
