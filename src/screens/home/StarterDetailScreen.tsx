import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal, TextInput as RNTextInput } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { Heading, Body, Caption, Label } from '../../components/Typography';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { getStarter, getEventsForStarter, deleteStarter, createEvent } from '../../db';
import { Starter, StarterEvent } from '../../models/types';
import { formatDuration } from '../../utils/feedCalculations';
import { HomeStackParamList } from '../../navigation/types';
import { formatTimelineNotes } from '../../utils/timelineFormat';
import { ensureActiveStarterId } from '../../utils/activeStarter';

type Props = NativeStackScreenProps<HomeStackParamList, 'StarterDetail'>;

export function StarterDetailScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { isPro } = useSubscription();
  const { starterId } = route.params;
  const [starter, setStarter] = useState<Starter | null>(null);
  const [events, setEvents] = useState<StarterEvent[]>([]);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showNoteBanner, setShowNoteBanner] = useState(false);
  const [activeStarterId, setActiveStarterIdState] = useState<string | null>(null);
  const [starterCount, setStarterCount] = useState(0);

  const load = useCallback(async () => {
    const { activeStarterId: activeId, starterCount: count } = await ensureActiveStarterId(isPro);
    setStarterCount(count);
    setActiveStarterIdState(activeId);
    const s = await getStarter(starterId);
    setStarter(s);
    const e = await getEventsForStarter(starterId, 20);
    setEvents(e);
  }, [isPro, starterId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function handleSaveNote() {
    if (!isPro && starterCount > 1 && activeStarterId && activeStarterId !== starterId) return;
    const trimmed = noteText.trim();
    if (trimmed.length === 0) return;
    setSavingNote(true);
    try {
      await createEvent({
        type: 'NOTE',
        starter_id: starterId,
        timestamp: new Date().toISOString(),
        notes: trimmed,
      });
      setShowNoteModal(false);
      setNoteText('');
      setShowNoteBanner(true);
      await load();
    } catch (error) {
      console.error('Failed to save note:', error);
      Alert.alert('Could not save note');
    } finally {
      setSavingNote(false);
    }
  }

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
  const isLocked = !isPro && starterCount > 1 && !!activeStarterId && activeStarterId !== starterId;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      {showNoteBanner && (
        <Banner
          message="Note added"
          variant="success"
          onDismiss={() => setShowNoteBanner(false)}
        />
      )}
      {isLocked && (
        <Banner
          message={"Multiple cultures are a Pro feature.\nUpgrade to unlock unlimited cultures."}
          variant="info"
          actionLabel="Upgrade"
          onAction={() => navigation.getParent()?.navigate('ProPaywall' as never)}
        />
      )}
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
          disabled={isLocked}
          style={{ flex: 1, marginRight: 8 }}
        />
        <Button
          title="Edit"
          variant="secondary"
          onPress={() => navigation.navigate('EditStarter', { mode: 'edit', starterId })}
          disabled={isLocked}
          style={{ flex: 1, marginLeft: 8 }}
        />
      </View>
      <TouchableOpacity
        style={styles.addNoteLink}
        onPress={() => !isLocked && setShowNoteModal(true)}
        activeOpacity={0.7}
      >
        <Caption style={{ color: theme.colors.primary }}>{isLocked ? 'Add Note (Pro)' : 'Add Note'}</Caption>
      </TouchableOpacity>

      <Label style={{ marginTop: 24, marginBottom: 12 }}>Recent Activity</Label>
      {events.length === 0 ? (
        <Caption>No events yet.</Caption>
      ) : (
        events.map((event) => {
          const formatted = event.notes ? formatTimelineNotes(event.notes) : null;
          return (
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
              {formatted?.systemSummary && (
                <Caption style={{ marginTop: 6, color: theme.colors.textMuted ?? theme.colors.textSecondary }}>
                  {formatted.systemSummary}
                </Caption>
              )}
              {formatted?.displayNotes ? (
                <Caption style={{ marginTop: 6 }}>{formatted.displayNotes}</Caption>
              ) : null}
            </Card>
          );
        })
      )}

      <TouchableOpacity
        style={styles.deleteLink}
        onPress={handleDelete}
        activeOpacity={0.7}
      >
        <Caption style={{ color: theme.colors.danger }}>Remove culture</Caption>
      </TouchableOpacity>

      <Modal
        visible={showNoteModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowNoteModal(false);
          setNoteText('');
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Label style={{ marginBottom: 8 }}>Add Note</Label>
            <RNTextInput
              value={noteText}
              onChangeText={setNoteText}
              multiline
              editable={!savingNote}
              placeholder="Write a note..."
              placeholderTextColor={theme.colors.textSecondary}
              style={[
                styles.noteInput,
                {
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.inputBackground,
                },
              ]}
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setShowNoteModal(false);
                  setNoteText('');
                }}
                disabled={savingNote}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Save"
                onPress={handleSaveNote}
                loading={savingNote}
                disabled={noteText.trim().length === 0}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  addNoteLink: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  noteInput: {
    minHeight: 110,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 12,
  },
  deleteLink: {
    alignItems: 'center',
    marginTop: 32,
    paddingVertical: 12,
  },
});
