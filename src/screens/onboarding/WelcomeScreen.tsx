import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme';
import { Heading, Subheading } from '../../components/Typography';
import { Button } from '../../components/Button';
import { OnboardingStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Heading style={{ fontSize: 34, textAlign: 'center', marginBottom: 12 }}>
          StarterBuddy
        </Heading>
        <Subheading style={{ textAlign: 'center', lineHeight: 22, marginBottom: 48 }}>
          Track your sourdough cultures{'\n'}with intention and care.
        </Subheading>
      </View>
      <View style={styles.footer}>
        <Button
          title="Begin"
          onPress={() => navigation.navigate('NameStarter')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
});
