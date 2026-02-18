import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Text, Animated } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { Heading, Subheading, Body, Caption } from '../../components/Typography';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { getAllStarters, getLastFeedEvent } from '../../db';
import { Starter, StarterEvent } from '../../models/types';
import { getTimeUntilPeak, getPeakStatus, estimatePeakHoursFromRatio } from '../../utils/feedCalculations';
import { HomeStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeScreen'>;

interface StarterWithFeed extends Starter {
  lastFeed: StarterEvent | null;
  peakStatus: 'before' | 'within' | 'past' | 'dormant' | 'none';
  statusLine: string;
}

export function HomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { isPro } = useSubscription();
  const [starters, setStarters] = useState<StarterWithFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const adOpacity = useRef(new Animated.Value(0)).current;

  const loadStarters = useCallback(async () => {
    try {
      const allStarters = await getAllStarters();
      const enriched: StarterWithFeed[] = await Promise.all(
        allStarters.map(async (s) => {
          const lastFeed = await getLastFeedEvent(s.id);
          let peakStatus: StarterWithFeed['peakStatus'] = 'none';
          let statusLine = 'No feedings recorded';

          if (s.storage_mode === 'fridge' && !lastFeed) {
            peakStatus = 'dormant';
            statusLine = 'Dormant (fridge)';
          } else if (lastFeed) {
            const estimatedPeak = estimatePeakHoursFromRatio(
              s.preferred_ratio_a,
              s.preferred_ratio_b,
              s.baseline_peak_hours
            );

            if (s.storage_mode === 'fridge') {
              peakStatus = 'dormant';
              statusLine = 'Dormant (fridge)';
            } else {
              peakStatus = getPeakStatus(lastFeed.timestamp, estimatedPeak);
              if (peakStatus === 'within') {
                statusLine = 'Within optimal window';
              } else if (peakStatus === 'past') {
                statusLine = 'Past optimal window';
              } else {
                statusLine = getTimeUntilPeak(lastFeed.timestamp, estimatedPeak);
              }
            }
          }

          return { ...s, lastFeed, peakStatus, statusLine };
        })
      );
      setStarters(enriched);
    } catch (e) {
      console.error('Failed to load starters:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStarters();
    }, [loadStarters])
  );

  // Fade in ad
  useEffect(() => {
    if (!isPro && !loading) {
      Animated.timing(adOpacity, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isPro, loading]);

  function handleAddStarter() {
    if (!isPro && starters.length >= 1) {
      navigation.navigate('ProPaywall' as any);
      return;
    }
    navigation.navigate('EditStarter', { mode: 'create' });
  }

  function getLastFedString(event: StarterEvent | null): string {
    if (!event) return 'Never fed';
    const feedDate = new Date(event.timestamp);
    const now = new Date();
    const diffMs = now.getTime() - feedDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) return `Fed ${Math.round(diffHours * 60)}m ago`;
    if (diffHours < 24) return `Fed ${Math.round(diffHours)}h ago`;
    const days = Math.floor(diffHours / 24);
    return `Fed ${days}d ago`;
  }

  const isSingle = starters.length === 1;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerCenter}>
          <Heading style={{ fontSize: 28, textAlign: 'center' }}>StarterBuddy</Heading>
          <Subheading style={{ textAlign: 'center', marginTop: 2 }}>Your cultures</Subheading>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { borderColor: theme.colors.primary }]}
          onPress={handleAddStarter}
          activeOpacity={0.7}
        >
          <Text style={[styles.addButtonText, { color: theme.colors.primary }]}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Peak banners */}
      {starters
        .filter((s) => s.peakStatus === 'within')
        .map((s) => (
          <Banner
            key={`peak-${s.id}`}
            message="Your culture may be ready."
            actionLabel="Confirm"
            variant="warning"
            onAction={() =>
              navigation.navigate('ConfirmPeak', {
                starterId: s.id,
                starterName: s.name,
              })
            }
          />
        ))}

      {/* Starter cards */}
      {starters.map((starter) => (
        <TouchableOpacity
          key={starter.id}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('StarterDetail', { starterId: starter.id })}
        >
          <Card
            style={
              isSingle
                ? { marginVertical: 16, paddingVertical: 28 }
                : undefined
            }
          >
            <View style={styles.cardHeader}>
              <Heading style={{ fontSize: isSingle ? 22 : 20 }}>{starter.name}</Heading>
              {starter.peakStatus === 'within' && (
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('ConfirmPeak', {
                      starterId: starter.id,
                      starterName: starter.name,
                    })
                  }
                >
                  <Caption style={{ color: theme.colors.accent }}>Confirm Peak</Caption>
                </TouchableOpacity>
              )}
            </View>

            <Body
              style={{
                color:
                  starter.peakStatus === 'within'
                    ? theme.colors.accent
                    : starter.peakStatus === 'past'
                    ? theme.colors.danger
                    : theme.colors.textSecondary,
                marginTop: 4,
              }}
            >
              {starter.statusLine}
            </Body>

            <View style={styles.cardMeta}>
              <Caption>{getLastFedString(starter.lastFeed)}</Caption>
              <Caption>{starter.hydration_target}% hydration</Caption>
            </View>

            <View style={styles.cardActions}>
              <Button
                title="Feed"
                onPress={() => navigation.navigate('FeedWizard', { starterId: starter.id })}
                style={{ flex: 1, marginRight: 12 }}
              />
              <View style={styles.secondaryActions}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('FeedWizard', { starterId: starter.id, goal: 'Build Levain' })}
                >
                  <Caption style={{ color: theme.colors.primary }}>Use</Caption>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    // Quick action to move to fridge
                  }}
                >
                  <Caption style={{ color: theme.colors.primary }}>Chill</Caption>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate('StarterDetail', { starterId: starter.id })}
                >
                  <Caption style={{ color: theme.colors.primary }}>Log Note</Caption>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        </TouchableOpacity>
      ))}

      {/* Ad banner placeholder for free users */}
      {!isPro && starters.length > 0 && (
        <Animated.View style={[styles.adContainer, { opacity: adOpacity }]}>
          <View
            style={[
              styles.adPlaceholder,
              {
                backgroundColor: theme.colors.inputBackground,
                borderRadius: theme.radii.sm,
              },
            ]}
          >
            <Caption style={{ textAlign: 'center' }}>Ad Space</Caption>
          </View>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  addButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 22,
    fontWeight: '300',
    marginTop: -1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 16,
  },
  cardActions: {
    marginTop: 4,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 12,
  },
  adContainer: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  adPlaceholder: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
