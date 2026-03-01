import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Heading, Subheading } from '../../components/Typography';
import { Button } from '../../components/Button';
import { TextInput } from '../../components/TextInput';
import { OnboardingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Hydration'>;

export function HydrationScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { name, storageMode } = route.params;
  const [hydration, setHydration] = useState('100');

  const hydrationValue = parseInt(hydration, 10);
  const isValid = !isNaN(hydrationValue) && hydrationValue >= 50 && hydrationValue <= 200;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Heading style={{ marginBottom: 8 }}>Target hydration</Heading>
        <Subheading style={{ marginBottom: 32 }}>
          Hydration shapes texture and fermentation speed.
        </Subheading>
        <TextInput
          label="Hydration"
          suffix="%"
          value={hydration}
          onChangeText={setHydration}
          keyboardType="number-pad"
          placeholder="100"
        />
      </View>
      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={() =>
            navigation.navigate('FeedingRhythm', {
              name,
              storageMode,
              hydration: hydrationValue,
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
