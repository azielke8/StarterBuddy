import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../theme';
import { Body, Caption } from '../../components/Typography';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { getAllStarters, getAllEvents, createStarter, createEvent, deleteStarter } from '../../db';
import { ExportData } from '../../models/types';

const SCHEMA_VERSION = 1;

export function ExportImportScreen() {
  const { theme } = useTheme();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const starters = await getAllStarters();
      const events = await getAllEvents();

      const data: ExportData = {
        version: SCHEMA_VERSION,
        exported_at: new Date().toISOString(),
        starters,
        events,
      };

      const json = JSON.stringify(data, null, 2);
      const file = new File(Paths.cache, 'starterbuddy-backup.json');
      file.create({ overwrite: true });
      file.write(json);

      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        UTI: 'public.json',
      });
    } catch (e) {
      console.error('Export failed:', e);
      Alert.alert('Export failed', 'An error occurred while exporting data.');
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const pickedFile = result.assets[0];
      const file = new File(pickedFile.uri);
      const content = await file.text();
      const data: ExportData = JSON.parse(content);

      if (!data.version || !data.starters || !data.events) {
        Alert.alert('Invalid file', 'The selected file is not a valid StarterBuddy backup.');
        return;
      }

      Alert.alert(
        'Import data',
        `This backup contains ${data.starters.length} starter(s) and ${data.events.length} event(s).`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Overwrite',
            style: 'destructive',
            onPress: () => performImport(data, 'overwrite'),
          },
          {
            text: 'Merge',
            onPress: () => performImport(data, 'merge'),
          },
        ]
      );
    } catch (e) {
      console.error('Import failed:', e);
      Alert.alert('Import failed', 'An error occurred while importing data.');
    }
  }

  async function performImport(data: ExportData, mode: 'overwrite' | 'merge') {
    setImporting(true);
    try {
      if (mode === 'overwrite') {
        const existing = await getAllStarters();
        for (const s of existing) {
          await deleteStarter(s.id);
        }
      }

      for (const starter of data.starters) {
        await createStarter({
          name: starter.name,
          photo_uri: starter.photo_uri,
          flour_type: starter.flour_type,
          hydration_target: starter.hydration_target,
          storage_mode: starter.storage_mode,
          preferred_ratio_a: starter.preferred_ratio_a,
          preferred_ratio_b: starter.preferred_ratio_b,
          preferred_ratio_c: starter.preferred_ratio_c,
          default_feed_interval_hours: starter.default_feed_interval_hours,
        });
      }

      // Import events — associate with new starter IDs by name match
      const importedStarters = await getAllStarters();
      const nameToId = new Map(importedStarters.map((s) => [s.name, s.id]));
      const oldIdToName = new Map(data.starters.map((s) => [s.id, s.name]));

      for (const event of data.events) {
        const starterName = oldIdToName.get(event.starter_id);
        const newStarterId = starterName ? nameToId.get(starterName) : undefined;
        if (newStarterId) {
          await createEvent({
            starter_id: newStarterId,
            type: event.type,
            timestamp: event.timestamp,
            starter_g: event.starter_g,
            flour_g: event.flour_g,
            water_g: event.water_g,
            ratio_string: event.ratio_string,
            ambient_temp: event.ambient_temp,
            peak_confirmed_hours: event.peak_confirmed_hours,
            notes: event.notes,
          });
        }
      }

      Alert.alert('Import complete', 'Your data has been imported.');
    } catch (e) {
      console.error('Import failed:', e);
      Alert.alert('Import failed', 'An error occurred during import.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Card style={{ marginHorizontal: 0, marginBottom: 16 }}>
        <Body style={{ marginBottom: 8 }}>Export</Body>
        <Caption style={{ marginBottom: 16, lineHeight: 18 }}>
          Save all your cultures and history as a JSON file.
        </Caption>
        <Button title="Export Data" onPress={handleExport} loading={exporting} />
      </Card>

      <Card style={{ marginHorizontal: 0 }}>
        <Body style={{ marginBottom: 8 }}>Import</Body>
        <Caption style={{ marginBottom: 16, lineHeight: 18 }}>
          Restore from a StarterBuddy backup file.
        </Caption>
        <Button
          title="Import Data"
          variant="secondary"
          onPress={handleImport}
          loading={importing}
        />
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
});
