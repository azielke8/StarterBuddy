import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Heading, Subheading, Caption } from '../../components/Typography';
import { Button } from '../../components/Button';
import { TextInput } from '../../components/TextInput';
import { OnboardingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'FeedingRhythm'>;

export function FeedingRhythmScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { name, storageMode, hydration } = route.params;
  const defaultInterval = storageMode === 'fridge' ? '168' : '12';
  const [interval, setInterval] = useState(defaultInterval);

  const intervalValue = parseInt(interval, 10);
  const isValid = !isNaN(intervalValue) && intervalValue >= 1 && intervalValue <= 720;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Heading style={{ marginBottom: 8 }}>Feeding rhythm</Heading>
        <Subheading style={{ marginBottom: 32 }}>
          How often do you refresh this culture?{'\n'}You can adjust anytime.
        </Subheading>
        <TextInput
          label="Interval"
          suffix="hours"
          value={interval}
          onChangeText={setInterval}
          keyboardType="number-pad"
          placeholder="12"
        />
        <Caption style={{ marginTop: 4 }}>
          {storageMode === 'fridge'
            ? 'Fridge cultures typically need weekly feedings.'
            : 'Counter cultures typically need feeding every 8–24 hours.'}
        </Caption>
      </View>
      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={() =>
            navigation.navigate('Completion', {
              name,
              storageMode,
              hydration,
              feedIntervalHours: intervalValue,
            })
          }
          disabled={!isValid}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
});
