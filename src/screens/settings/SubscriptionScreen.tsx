import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { Heading, Body, Caption, Subheading } from '../../components/Typography';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useSubscription } from '../../contexts/SubscriptionContext';

const BENEFITS = [
  'Unlimited starters',
  'Levain planner',
  'Advanced peak modeling',
  'Dark Mode',
  'Analytics',
  'Ad-free',
];

export function SubscriptionScreen() {
  const { theme } = useTheme();
  const { isPro, offerings, purchase, restore } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  async function handlePurchase() {
    if (offerings.length === 0) return;
    setLoading(true);
    await purchase(offerings[0]);
    setLoading(false);
  }

  async function handleRestore() {
    setRestoring(true);
    await restore();
    setRestoring(false);
  }

  if (isPro) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.proContent}>
          <Heading style={{ textAlign: 'center', marginBottom: 8 }}>Baker's Table</Heading>
          <Body style={{ textAlign: 'center', color: theme.colors.success }}>Active</Body>
          <Caption style={{ textAlign: 'center', marginTop: 16, color: theme.colors.textSecondary }}>
            Thank you for supporting StarterBuddy.
          </Caption>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Heading style={{ fontSize: 28, textAlign: 'center' }}>Join Baker's Table.</Heading>
        <Subheading style={{ textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
          For bakers who take{'\n'}fermentation seriously.
        </Subheading>
      </View>

      <Card style={{ marginHorizontal: 0, marginBottom: 24 }}>
        {BENEFITS.map((benefit, i) => (
          <View key={benefit} style={[styles.benefitRow, i < BENEFITS.length - 1 && { marginBottom: 10 }]}>
            <Body style={{ color: theme.colors.success, marginRight: 10 }}>•</Body>
            <Body>{benefit}</Body>
          </View>
        ))}
      </Card>

      <Button
        title="Join Baker's Table"
        onPress={handlePurchase}
        loading={loading}
        disabled={offerings.length === 0}
      />

      <Button
        title="Restore Purchase"
        variant="text"
        onPress={handleRestore}
        loading={restoring}
        style={{ marginTop: 12 }}
      />

      <Caption style={{ textAlign: 'center', marginTop: 24, color: theme.colors.textSecondary, lineHeight: 18 }}>
        Subscription renews automatically.{'\n'}Cancel anytime in App Store settings.
      </Caption>
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
  header: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  proContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
